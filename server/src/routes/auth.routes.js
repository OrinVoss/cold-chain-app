const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database/connection');
const config = require('../config');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const db = getDB();
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, phone: user.phone }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, username, display_name, role, phone, vehicle_id FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

module.exports = router;
