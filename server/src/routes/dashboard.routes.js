const express = require('express');
const { getDB } = require('../database/connection');

const router = express.Router();

router.get('/stats', (req, res) => {
  const db = getDB();
  const activeShipments = db.prepare("SELECT COUNT(*) as count FROM shipments WHERE status IN ('in_transit','assigned','loaded')").get();
  const todayOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now','localtime')").get();
  const activeAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE is_acknowledged = 0").get();
  const vehiclesOnRoute = db.prepare("SELECT COUNT(*) as count FROM shipments WHERE status = 'in_transit'").get();
  const deliveredToday = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'delivered' AND date(updated_at) = date('now','localtime')").get();

  const alertByLevel = db.prepare('SELECT level, COUNT(*) as count FROM alerts WHERE is_acknowledged = 0 GROUP BY level').all();

  // Cold-chain KPIs (from planning doc "四层两网一平台")
  const tempReadings = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN sr.value BETWEEN 0 AND 4 THEN 1 ELSE 0 END) as compliant
    FROM sensor_readings sr
    WHERE sr.recorded_at >= datetime('now', '-24 hours')
  `).get();
  const tempComplianceRate = tempReadings?.total > 0
    ? Math.round((tempReadings.compliant / tempReadings.total) * 100)
    : 95;

  const stockIn = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type = 'in'").get();
  const stockOut = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type = 'out'").get();
  const totalStock = (stockIn?.total || 0) - (stockOut?.total || 0);

  const expiryCount = db.prepare(`
    SELECT COUNT(*) as count FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    WHERE it.type = 'in'
      AND it.batch_date IS NOT NULL
      AND date(it.batch_date, '+' || p.shelf_life_days || ' days') <= date('now', '+3 days')
      AND date(it.batch_date, '+' || p.shelf_life_days || ' days') >= date('now')
  `).get();

  // Kanban counts (replaces N+1 from OverviewView loading all shipments)
  const kanbanCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM shipments GROUP BY status
  `).all();

  res.json({
    activeShipments: activeShipments?.count || 0,
    todayOrders: todayOrders?.count || 0,
    activeAlerts: activeAlerts?.count || 0,
    vehiclesOnRoute: vehiclesOnRoute?.count || 0,
    deliveredToday: deliveredToday?.count || 0,
    alertByLevel,
    tempComplianceRate,
    totalStockKg: totalStock,
    expiryAlerts: expiryCount?.count || 0,
    kanbanCounts
  });
});

router.get('/recent-alerts', (req, res) => {
  const db = getDB();
  const alerts = db.prepare(`
    SELECT a.*, v.plate_number
    FROM alerts a
    LEFT JOIN vehicles v ON a.vehicle_id = v.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();
  res.json(alerts);
});

router.get('/vehicle-positions', (req, res) => {
  const db = getDB();
  // Get latest position for each active vehicle
  const positions = db.prepare(`
    SELECT v.id as vehicle_id, v.plate_number, v.vehicle_type,
           sr.latitude, sr.longitude, sr.recorded_at as latest_time,
           s.id as shipment_id, s.status as shipment_status,
           u.display_name as driver_name
    FROM vehicles v
    INNER JOIN (
      SELECT vehicle_id, MAX(id) as max_id
      FROM sensor_readings WHERE latitude IS NOT NULL
      GROUP BY vehicle_id
    ) latest ON v.id = latest.vehicle_id
    INNER JOIN sensor_readings sr ON sr.id = latest.max_id
    LEFT JOIN shipments s ON s.vehicle_id = v.id AND s.status = 'in_transit'
    LEFT JOIN users u ON s.driver_id = u.id
    WHERE v.is_active = 1
  `).all();
  res.json(positions);
});

module.exports = router;
