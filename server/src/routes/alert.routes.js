const express = require('express');
const { getDB } = require('../database/connection');
const { getEmit } = require('../socket/handler');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const alerts = db.prepare(`
    SELECT a.*, v.plate_number
    FROM alerts a LEFT JOIN vehicles v ON a.vehicle_id = v.id
    ORDER BY a.created_at DESC LIMIT 50
  `).all();
  res.json(alerts);
});

router.put('/:id/acknowledge', (req, res) => {
  const db = getDB();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare('UPDATE alerts SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?').run(req.user.id, now, req.params.id);
  db.save();
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  const emit = getEmit(); if (emit) emit('alert:acknowledged', alert);
  res.json(alert);
});

router.get('/stats', (req, res) => {
  const db = getDB();
  const stats = db.prepare('SELECT level, COUNT(*) as count FROM alerts WHERE is_acknowledged = 0 GROUP BY level').all();
  res.json(stats);
});

module.exports = router;
