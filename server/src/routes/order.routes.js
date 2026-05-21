const express = require('express');
const { getDB } = require('../database/connection');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const orders = db.prepare(`
    SELECT o.*
    FROM orders o
    ORDER BY o.created_at DESC
    LIMIT 50
  `).all();

  // Get items for all orders (batch query, replaces N+1)
  if (orders.length > 0) {
    const ids = orders.map(o => o.id);
    const ph = ids.map(() => '?').join(',');
    const allItems = db.prepare(`
      SELECT oi.*, p.name as product_name, oi.order_id
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${ph})
    `).all(...ids);
    const itemsByOrder = {};
    for (const item of allItems) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }
    for (const order of orders) {
      order.items = itemsByOrder[order.id] || [];
      order.product_summary = order.items.map(i => i.product_name).join('、');
    }
  }

  res.json(orders);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.sku_code, p.category
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(req.params.id);
  order.items = items;
  res.json(order);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { customer_name, customer_phone, delivery_address, delivery_city, delivery_lat, delivery_lng, required_temp_min, required_temp_max, items, notes } = req.body;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const date = now.substring(0, 10).replace(/-/g, '');
  const countAll = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now','localtime')").get();
  const orderNumber = `ORD-${date}-${String((countAll?.c || 0) + 1).padStart(3, '0')}`;

  let totalWeight = 0;
  if (items && items.length > 0) {
    totalWeight = items.reduce((sum, i) => sum + (parseFloat(i.quantity_kg) || 0), 0);
  }

  db.prepare('INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_city, delivery_lat, delivery_lng, required_temp_min, required_temp_max, total_weight_kg, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(orderNumber, customer_name, customer_phone || '', delivery_address, delivery_city, delivery_lat || null, delivery_lng || null, required_temp_min || 0, required_temp_max || 4, totalWeight, notes || '');

  const result = db.prepare('SELECT last_insert_rowid() as id').get();
  const orderId = result.id;

  if (items && items.length > 0) {
    for (const item of items) {
      db.prepare('INSERT INTO order_items (order_id, product_id, quantity_kg) VALUES (?,?,?)').run(orderId, item.product_id, parseFloat(item.quantity_kg));
    }
  }

  db.save();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json(order);
});

router.put('/:id/status', (req, res) => {
  const db = getDB();
  const { status } = req.body;
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(status, req.params.id);
  db.save();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

router.put("/:id/cancel", (req, res) => {
  const db = getDB();
  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  db.save();
  res.json({ message: "订单已取消" });
});

router.get('/:id/journey', (req, res) => {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.sku_code, p.category
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(req.params.id);
  order.items = items;

  const stop = db.prepare(`
    SELECT ss.*, s.shipment_code, s.status as shipment_status, s.vehicle_id, s.driver_id,
           v.plate_number, v.vehicle_type, u.display_name as driver_name
    FROM shipment_stops ss
    JOIN shipments s ON ss.shipment_id = s.id
    LEFT JOIN vehicles v ON s.vehicle_id = v.id
    LEFT JOIN users u ON s.driver_id = u.id
    WHERE ss.order_id = ?
    ORDER BY ss.stop_sequence
  `).get(req.params.id);

  const statusFlow = [
    { status: 'pending', label: '订单已创建', icon: 'Document' },
    { status: 'confirmed', label: '订单已确认', icon: 'Check' },
    { status: 'processing', label: '已加入运输计划', icon: 'Box' },
    { status: 'in_transit', label: '运输中', icon: 'Van' },
    { status: 'delivered', label: '已签收', icon: 'CircleCheck' },
    { status: 'cancelled', label: '已取消', icon: 'CircleClose' }
  ];

  const timeline = [];
  for (const sf of statusFlow) {
    const ts = sf.status === order.status ? (order.updated_at || order.created_at) : null;
    timeline.push({ ...sf, time: ts, active: !!ts || statusFlow.indexOf(sf) <= statusFlow.findIndex(s => s.status === order.status) });
  }

  let latestTemps = null;
  if (stop && stop.vehicle_id) {
    const vehicle = db.prepare('SELECT device_id FROM vehicles WHERE id = ?').get(stop.vehicle_id);
    if (vehicle) {
      latestTemps = db.prepare(`
        SELECT s.sensor_position, s.sensor_type, r.value, r.recorded_at
        FROM sensor_readings r
        JOIN iot_sensors s ON r.sensor_id = s.id
        WHERE s.device_id = ? AND s.sensor_type = 'temperature'
        GROUP BY s.sensor_position
        HAVING r.recorded_at = MAX(r.recorded_at)
      `).all(vehicle.device_id);
    }
  }

  res.json({
    order,
    linkedShipment: stop || null,
    stops: stop ? [stop] : [],
    timeline,
    latestTemps
  });
});

router.delete("/:id", (req, res) => {
  const db = getDB();
  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  db.save();
  res.json({ message: "订单已取消" });
});

module.exports = router;
