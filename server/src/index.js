const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const initSchema = require('./database/schema');
const seed = require('./database/seed');
const { getDB } = require('./database/connection');
const config = require('./config');
const authMiddleware = require('./middleware/auth');
const simulator = require('./services/sensor-simulator');
const alertEngine = require('./services/alert-engine');
const { setupSocket } = require('./socket/handler');

// Auth routes (no middleware needed for login)
const authRoutes = require('./routes/auth.routes');

// Protected routes
const dashboardRoutes = require('./routes/dashboard.routes');
const sensorRoutes = require('./routes/sensor.routes');
const orderRoutes = require('./routes/order.routes');
const shipmentRoutes = require('./routes/shipment.routes');
const driverRoutes = require('./routes/driver.routes');
const alertRoutes = require('./routes/alert.routes');
const dispatchRoutes = require('./routes/dispatch.routes');
const warehouseRoutes = require('./routes/warehouse.routes');

async function main() {
  // Always start with a clean demo database
  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, '..', 'data', 'cold-chain.db');
  try { fs.unlinkSync(dbPath); } catch (e) { /* file doesn't exist */ }
  await initSchema();
  seed();

  const app = express();
  const server = http.createServer(app);

  // Socket.IO
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  const emit = setupSocket(io);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Public routes
  app.use('/api/v1/auth', authRoutes);

  // Protected routes
  app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/v1/sensors', authMiddleware, sensorRoutes);
  app.use('/api/v1/orders', authMiddleware, orderRoutes);
  app.use('/api/v1/shipments', authMiddleware, shipmentRoutes);
  app.use('/api/v1/driver', authMiddleware, driverRoutes);
  app.use('/api/v1/alerts', authMiddleware, alertRoutes);
  app.use('/api/v1/dispatch', authMiddleware, dispatchRoutes);
  app.use('/api/v1/warehouse', authMiddleware, warehouseRoutes);

  // Simulation control
  app.post('/api/v1/simulation/toggle', authMiddleware, (req, res) => {
    if (req.body.enabled) {
      simulator.start((event, data) => {
        emit(event, data);
        if (event === 'sensor:reading') {
          alertEngine.evaluate(data, (alertEvent, alertData) => {
            emit(alertEvent, alertData);
          });
        }
      });
      res.json({ message: '模拟器已启动', enabled: true });
    } else {
      simulator.stop();
      res.json({ message: '模拟器已停止', enabled: false });
    }
  });

  app.post('/api/v1/simulation/inject-alert', authMiddleware, (req, res) => {
    const vehicleId = req.body.vehicle_id || 1;
    const simState = simulator.anomalyState;
    if (!simState[vehicleId]) {
      simState[vehicleId] = { offset: 0, stepsLeft: 0 };
    }
    simState[vehicleId].offset = 10;
    simState[vehicleId].stepsLeft = 10;
    res.json({ message: `已为车辆 ${vehicleId} 注入温度异常`, vehicle_id: vehicleId });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  });

  // Start server
  server.listen(config.PORT, () => {
    console.log(`\n==========================================`);
    console.log(`  徽农优选冷链物流管理系统 API Server`);
    console.log(`  http://localhost:${config.PORT}`);
    console.log(`  WebSocket: ws://localhost:${config.PORT}`);
    console.log(`==========================================\n`);

    // Start sensor simulator
    simulator.start((event, data) => {
      emit(event, data);
      if (event === 'sensor:reading') {
        alertEngine.evaluate(data, (alertEvent, alertData) => {
          emit(alertEvent, alertData);
        });
      }
    });
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
