const express = require('express');
const { getDB } = require('../database/connection');
const warehouse = require('../services/warehouse-service');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  const data = warehouse.getDashboard();
  res.json(data);
});

router.get('/inventory', (req, res) => {
  const data = warehouse.getInventory();
  res.json(data);
});

router.get('/expiry-alerts', (req, res) => {
  const days = parseInt(req.query.days) || 3;
  const data = warehouse.getExpiryAlerts(days);
  res.json(data);
});

router.post('/stock-in', (req, res) => {
  const { product_id, quantity_kg, notes } = req.body;
  if (!product_id || !quantity_kg) {
    return res.status(400).json({ error: '缺少 product_id 或 quantity_kg' });
  }
  warehouse.stockIn(product_id, parseFloat(quantity_kg), notes);
  res.status(201).json({ message: '入库成功' });
});

router.post('/stock-out', (req, res) => {
  const { product_id, quantity_kg, reference_type, reference_id, notes } = req.body;
  if (!product_id || !quantity_kg) {
    return res.status(400).json({ error: '缺少 product_id 或 quantity_kg' });
  }
  warehouse.stockOut(product_id, parseFloat(quantity_kg), reference_type, reference_id, notes);
  res.status(201).json({ message: '出库成功' });
});

router.get('/transactions', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const data = warehouse.getTransactions(limit);
  res.json(data);
});

module.exports = router;
