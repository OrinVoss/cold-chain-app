const express = require('express');
const { getDB } = require('../database/connection');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const sensors = db.prepare(`
    SELECT s.id, s.device_id, s.sensor_position, s.sensor_type,
           v.plate_number, v.vehicle_type, v.id as vehicle_id,
           sr.value as latest_value, sr.recorded_at as latest_time
    FROM iot_sensors s
    JOIN vehicles v ON s.device_id = v.device_id
    LEFT JOIN (
      SELECT sensor_id, MAX(id) as max_id
      FROM sensor_readings GROUP BY sensor_id
    ) lr ON s.id = lr.sensor_id
    LEFT JOIN sensor_readings sr ON sr.id = lr.max_id
    WHERE s.sensor_type = 'temperature'
    ORDER BY v.id, s.sensor_position
  `).all();
  res.json(sensors);
});

router.get('/:id/readings', (req, res) => {
  const db = getDB();
  const limit = parseInt(req.query.limit) || 100;
  const readings = db.prepare('SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY id DESC LIMIT ?').all(req.params.id, limit);
  res.json(readings.reverse());
});

router.get('/vehicle/:vehicleId', (req, res) => {
  const db = getDB();
  const deviceId = db.prepare('SELECT device_id FROM vehicles WHERE id = ?').get(req.params.vehicleId);
  if (!deviceId) return res.status(404).json({ error: '车辆不存在' });
  const readings = db.prepare(`
    SELECT s.id as sensor_id, s.sensor_position, s.sensor_type, s.device_id,
           sr.value, sr.recorded_at
    FROM iot_sensors s
    LEFT JOIN (
      SELECT sensor_id, MAX(id) as max_id
      FROM sensor_readings GROUP BY sensor_id
    ) lr ON s.id = lr.sensor_id
    LEFT JOIN sensor_readings sr ON sr.id = lr.max_id
    WHERE s.device_id = ?
  `).all(deviceId.device_id);
  res.json(readings);
});

router.get('/vehicle/:vehicleId/latest', (req, res) => {
  const db = getDB();
  const device = db.prepare('SELECT device_id FROM vehicles WHERE id = ?').get(req.params.vehicleId);
  if (!device) return res.status(404).json({ error: '车辆不存在' });
  const readings = db.prepare(`
    SELECT s.id as sensor_id, s.sensor_position, s.sensor_type, s.device_id,
           sr.value, sr.recorded_at, sr.latitude, sr.longitude
    FROM iot_sensors s
    LEFT JOIN (
      SELECT sensor_id, MAX(id) as max_id
      FROM sensor_readings WHERE vehicle_id = ? GROUP BY sensor_id
    ) lr ON s.id = lr.sensor_id
    LEFT JOIN sensor_readings sr ON sr.id = lr.max_id
    WHERE s.device_id = ?
  `).all(req.params.vehicleId, device.device_id);
  res.json(readings);
});

module.exports = router;
