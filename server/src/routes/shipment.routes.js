const express = require('express');
const { getDB } = require('../database/connection');
const { getEmit } = require('../socket/handler');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const shipments = db.prepare(`
    SELECT s.*, v.plate_number, v.vehicle_type, u.display_name as driver_name
    FROM shipments s
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    LEFT JOIN users u ON s.driver_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 50
  `).all();

  if (shipments.length > 0) {
    const ids = shipments.map(s => s.id);
    const placeholders = ids.map(() => '?').join(',');
    const allStops = db.prepare(`
      SELECT ss.*, o.customer_name
      FROM shipment_stops ss JOIN orders o ON ss.order_id = o.id
      WHERE ss.shipment_id IN (${placeholders})
      ORDER BY ss.shipment_id, ss.stop_sequence
    `).all(...ids);
    const stopsByShipment = {};
    for (const stop of allStops) {
      if (!stopsByShipment[stop.shipment_id]) stopsByShipment[stop.shipment_id] = [];
      stopsByShipment[stop.shipment_id].push(stop);
    }
    for (const ship of shipments) {
      const stops = stopsByShipment[ship.id] || [];
      ship.stop_count = stops.length;
      ship.stops_summary = stops.map(s => s.customer_name).join(' → ');
      ship.stops = stops;
    }
  }

  res.json(shipments);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const shipment = db.prepare(`
    SELECT s.*, v.plate_number, v.vehicle_type, v.device_id,
           u.display_name as driver_name, u.phone as driver_phone
    FROM shipments s
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    LEFT JOIN users u ON s.driver_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!shipment) return res.status(404).json({ error: '运输任务不存在' });

  const stops = db.prepare(`
    SELECT ss.*, o.order_number, o.customer_name, o.delivery_address,
           o.delivery_city, o.delivery_lat, o.delivery_lng,
           o.required_temp_min, o.required_temp_max
    FROM shipment_stops ss JOIN orders o ON ss.order_id = o.id
    WHERE ss.shipment_id = ? ORDER BY ss.stop_sequence
  `).all(req.params.id);
  shipment.stops = stops;

  res.json(shipment);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { vehicle_id, driver_id, order_ids } = req.body;
  const date = new Date().toISOString().replace('T', ' ').substring(0, 10).replace(/-/g, '');
  const countAll = db.prepare("SELECT COUNT(*) as c FROM shipments WHERE date(created_at) = date('now','localtime')").get();
  const shipmentCode = `SHP-${date}-${String((countAll?.c || 0) + 1).padStart(3, '0')}`;

  let totalWeight = 0;
  if (order_ids && order_ids.length > 0) {
    for (const oid of order_ids) {
      const items = db.prepare('SELECT SUM(quantity_kg) as w FROM order_items WHERE order_id = ?').get(oid);
      totalWeight += (items?.w || 0);
    }
  }

  db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, total_weight_kg, route_order) VALUES (?,?,?,?,?)').run(shipmentCode, vehicle_id || null, driver_id || null, totalWeight, JSON.stringify(order_ids || []));

  const result = db.prepare('SELECT last_insert_rowid() as id').get();
  const shipmentId = result.id;

  if (order_ids && order_ids.length > 0) {
    order_ids.forEach((oid, i) => {
      db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence) VALUES (?,?,?)').run(shipmentId, oid, i + 1);
      db.prepare("UPDATE orders SET status = 'processing' WHERE id = ?").run(oid);
    });
  }

  if (vehicle_id) {
    db.prepare("UPDATE shipments SET status = 'assigned' WHERE id = ?").run(shipmentId);
  }

  db.save();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
  res.status(201).json(shipment);
});

router.put('/:id/status', (req, res) => {
  const db = getDB();
  const { status } = req.body;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const old = db.prepare('SELECT status FROM shipments WHERE id = ?').get(req.params.id);
  db.prepare("UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?").run(status, now, req.params.id);
  const emit = getEmit();
  if (emit) emit('shipment:status-change', { shipment_id: req.params.id, old_status: old?.status, new_status: status });

  if (status === 'completed') {
    const stopOrders = db.prepare('SELECT order_id FROM shipment_stops WHERE shipment_id = ?').all(req.params.id);
    for (const so of stopOrders) {
      db.prepare("UPDATE orders SET status = 'delivered', updated_at = ? WHERE id = ?").run(now, so.order_id);
    }
  }

  db.save();
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
  res.json(shipment);
});

router.put('/:id/stops/:stopId', (req, res) => {
  const db = getDB();
  const { status } = req.body;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (status === 'arrived') {
    db.prepare('UPDATE shipment_stops SET status = ?, actual_arrival = ? WHERE id = ? AND shipment_id = ?').run(status, now, req.params.stopId, req.params.id);
  } else if (status === 'delivered') {
    db.prepare("UPDATE shipment_stops SET status = 'delivered', actual_arrival = COALESCE(actual_arrival, ?) WHERE id = ? AND shipment_id = ?").run(now, req.params.stopId, req.params.id);
    const stop = db.prepare('SELECT order_id FROM shipment_stops WHERE id = ?').get(req.params.stopId);
    if (stop) {
      db.prepare("UPDATE orders SET status = 'delivered', updated_at = ? WHERE id = ?").run(now, stop.order_id);
    }
    const remaining = db.prepare("SELECT COUNT(*) as c FROM shipment_stops WHERE shipment_id = ? AND status != 'delivered'").get(req.params.id);
    if (remaining && remaining.c === 0) {
      db.prepare("UPDATE shipments SET status = 'completed', updated_at = ? WHERE id = ?").run(now, req.params.id);
    }
  } else {
    db.prepare('UPDATE shipment_stops SET status = ? WHERE id = ? AND shipment_id = ?').run(status, req.params.stopId, req.params.id);
  }

  db.save();
  const updatedStop = db.prepare('SELECT * FROM shipment_stops WHERE id = ?').get(req.params.stopId);
  res.json(updatedStop);
});

module.exports = router;
