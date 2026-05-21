const express = require('express');
const { getDB } = require('../database/connection');
const { getEmit } = require('../socket/handler');

const router = express.Router();

router.get('/tasks', (req, res) => {
  const db = getDB();
  const driverId = req.user.id;

  const tasks = db.prepare(`
    SELECT s.id, s.shipment_code, s.status, s.total_weight_kg, s.vehicle_id,
           v.plate_number, v.vehicle_type, v.device_id,
           COUNT(ss.id) as total_stops,
           SUM(CASE WHEN ss.status = 'delivered' THEN 1 ELSE 0 END) as delivered_stops
    FROM shipments s
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    LEFT JOIN shipment_stops ss ON ss.shipment_id = s.id
    WHERE s.driver_id = ?
      AND s.status IN ('assigned','loaded','in_transit')
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all(driverId);

  res.json(tasks);
});

router.get('/tasks/:id', (req, res) => {
  const db = getDB();
  const task = db.prepare(`
    SELECT s.*, v.plate_number, v.vehicle_type, v.device_id
    FROM shipments s
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.id = ? AND s.driver_id = ?
  `).get(req.params.id, req.user.id);

  if (!task) return res.status(404).json({ error: '任务不存在' });

  const stops = db.prepare(`
    SELECT ss.*, o.order_number, o.customer_name, o.customer_phone,
           o.delivery_address, o.delivery_city, o.total_weight_kg,
           o.required_temp_min, o.required_temp_max
    FROM shipment_stops ss JOIN orders o ON ss.order_id = o.id
    WHERE ss.shipment_id = ? ORDER BY ss.stop_sequence
  `).all(req.params.id);
  task.stops = stops;

  // Latest temperatures
  if (task.device_id) {
    const temps = db.prepare(`
      SELECT s.sensor_position,
             (SELECT sr.value FROM sensor_readings sr WHERE sr.sensor_id = s.id ORDER BY sr.id DESC LIMIT 1) as latest_value
      FROM iot_sensors s
      WHERE s.device_id = ? AND s.sensor_type = 'temperature'
    `).all(task.device_id);
    task.temperatures = temps;
  }

  res.json(task);
});

router.put('/tasks/:id/accept', (req, res) => {
  const db = getDB();
  db.prepare("UPDATE shipments SET status = 'assigned', updated_at = datetime('now','localtime') WHERE id = ? AND driver_id = ?").run(req.params.id, req.user.id);
  db.save();
  const emit = getEmit(); if (emit) emit('shipment:status-change', { shipment_id: req.params.id, new_status: 'assigned' });
  res.json({ message: '已接受任务' });
});

router.put('/tasks/:id/start', (req, res) => {
  const db = getDB();
  db.prepare("UPDATE shipments SET status = 'in_transit', updated_at = datetime('now','localtime') WHERE id = ? AND driver_id = ?").run(req.params.id, req.user.id);
  const stops = db.prepare('SELECT order_id FROM shipment_stops WHERE shipment_id = ?').all(req.params.id);
  for (const s of stops) {
    db.prepare("UPDATE orders SET status = 'in_transit', updated_at = datetime('now','localtime') WHERE id = ?").run(s.order_id);
  }
  db.save();
  const emit = getEmit(); if (emit) emit('shipment:status-change', { shipment_id: req.params.id, new_status: 'in_transit' });
  res.json({ message: '运输已开始' });
});

router.post('/location', (req, res) => {
  const { latitude, longitude } = req.body;
  res.json({ message: '位置已更新', latitude, longitude });
});

router.get('/alerts', (req, res) => {
  const db = getDB();
  const driverId = req.user.id;
  const user = db.prepare('SELECT vehicle_id FROM users WHERE id = ?').get(driverId);
  let alerts = [];
  if (user && user.vehicle_id) {
    alerts = db.prepare(`
      SELECT a.*, v.plate_number
      FROM alerts a LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.vehicle_id = ? ORDER BY a.created_at DESC LIMIT 30
    `).all(user.vehicle_id);
  }
  res.json(alerts);
});

router.put('/alerts/:id/acknowledge', (req, res) => {
  const db = getDB();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare('UPDATE alerts SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?').run(req.user.id, now, req.params.id);
  db.save();
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  const emit = getEmit(); if (emit) emit('alert:acknowledged', alert);
  res.json(alert);
});

// Driver cold chain credit score (from planning doc §4.3.1)
router.get('/credit-score', (req, res) => {
  const db = getDB();
  const driverId = req.user.id;
  const user = db.prepare('SELECT vehicle_id FROM users WHERE id = ?').get(driverId);

  if (!user || !user.vehicle_id) {
    return res.json({ score: 75, level: 'silver', tempCompliance: 92, onTimeRate: 78, alertResponse: 85 });
  }

  // Temperature compliance: % of readings within 0-4°C
  const tempReadings = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN sr.value BETWEEN 0 AND 4 THEN 1 ELSE 0 END) as compliant
    FROM sensor_readings sr
    JOIN iot_sensors s ON sr.sensor_id = s.id
    WHERE s.device_id = (SELECT device_id FROM vehicles WHERE id = ?)
      AND sr.recorded_at >= datetime('now', '-7 days')
  `).get(user.vehicle_id);

  const tempCompliance = tempReadings?.total > 0
    ? Math.round((tempReadings.compliant / tempReadings.total) * 100)
    : 85;

  // On-time delivery rate (simulated)
  const deliveries = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN ss.status = 'delivered' THEN 1 ELSE 0 END) as done
    FROM shipment_stops ss
    JOIN shipments s ON ss.shipment_id = s.id
    WHERE s.driver_id = ?
  `).get(driverId);

  const onTimeRate = Math.min(98, 75 + (deliveries?.done || 0) * 5);

  // Alert response speed (simulated)
  const alerts = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN a.is_acknowledged = 1 THEN 1 ELSE 0 END) as acknowledged
    FROM alerts a WHERE a.vehicle_id = ?
  `).get(user.vehicle_id);

  const alertResponse = Math.min(98, 70 + (alerts?.acknowledged || 0) * 5);

  // Composite score
  const score = Math.round(tempCompliance * 0.5 + onTimeRate * 0.3 + alertResponse * 0.2);
  const level = score >= 90 ? 'gold' : score >= 75 ? 'silver' : 'bronze';

  res.json({ score, level, tempCompliance, onTimeRate, alertResponse });
});

module.exports = router;
