const express = require('express');
const { getDB } = require('../database/connection');
const { getEmit } = require('../socket/handler');
const { suggestDispatches, executeDispatch } = require('../services/dispatch-engine');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const db = getDB();
  const assignableOrders = db.prepare(`
    SELECT o.* FROM orders o
    WHERE o.status IN ('pending','confirmed')
      AND o.id NOT IN (SELECT order_id FROM shipment_stops)
    ORDER BY o.created_at DESC
  `).all();
  for (const o of assignableOrders) {
    const items = db.prepare('SELECT oi.*, p.name as product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(o.id);
    o.product_summary = items.map(i => i.product_name).join('、');
  }

  const busyVehicleIds = db.prepare("SELECT DISTINCT vehicle_id FROM shipments WHERE status IN ('in_transit','assigned','loaded')").all().map(r => r.vehicle_id);
  const availableVehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all().map(v => ({
    ...v,
    is_busy: busyVehicleIds.includes(v.id)
  }));

  const drivers = db.prepare("SELECT id, display_name, phone, vehicle_id FROM users WHERE role = 'driver' AND is_active = 1").all();
  const availableDrivers = drivers.map(d => {
    const busy = db.prepare("SELECT id FROM shipments WHERE driver_id = ? AND status IN ('in_transit','assigned','loaded')").get(d.id);
    return { ...d, is_busy: !!busy };
  });

  const activeShipments = db.prepare(`
    SELECT s.*, v.plate_number, v.vehicle_type, u.display_name as driver_name
    FROM shipments s LEFT JOIN vehicles v ON s.vehicle_id = v.id LEFT JOIN users u ON s.driver_id = u.id
    WHERE s.status IN ('planned','assigned','loaded','in_transit')
    ORDER BY s.status, s.created_at DESC
  `).all();

  res.json({ assignableOrders, availableVehicles, availableDrivers, activeShipments });
});

router.post('/suggest', (req, res) => {
  const { order_ids } = req.body;
  if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
    return res.status(400).json({ error: '请选择至少一个订单' });
  }
  const result = suggestDispatches(order_ids);
  res.json(result);
});

router.post('/execute', (req, res) => {
  const { plan } = req.body;
  if (!plan || !plan.groups || plan.groups.length === 0) {
    return res.status(400).json({ error: '无效的调度方案' });
  }
  try {
    const results = executeDispatch(plan, req.user);
    const emit = getEmit();
    if (emit) {
      results.forEach(r => emit('shipment:status-change', { shipment_id: r.shipmentId, new_status: 'assigned' }));
    }
    res.status(201).json({ message: `已创建 ${results.length} 个运输任务`, shipments: results });
  } catch (e) {
    console.error('[Dispatch] Execute error:', e.message);
    res.status(500).json({ error: '派单执行失败' });
  }
});

module.exports = router;
