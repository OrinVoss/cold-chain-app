const jwt = require('jsonwebtoken');
const config = require('../config');

let _emit = null;

function getEmit() { return _emit; }

module.exports = { setupSocket, getEmit };

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未提供认证令牌'));
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('令牌无效'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.user.username} (${socket.user.role})`);

    socket.on('driver:gps', (data) => {
      console.log(`[Socket] Driver GPS: ${socket.user.username} -> ${data.latitude}, ${data.longitude}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.user.username}`);
    });
  });

  _emit = (event, data) => { io.emit(event, data); };
  return _emit;
}
