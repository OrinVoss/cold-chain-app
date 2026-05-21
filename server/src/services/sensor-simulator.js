const { getDB } = require('../database/connection');
const config = require('../config');

// Predefined routes: accurate city coordinates
// 黄山: 29.715°N 118.337°E | 杭州: 30.274°N 120.155°E | 上海: 31.230°N 121.473°E
const ROUTES = {
  1: { // Vehicle 1: 黄山 → 杭州 (G56杭徽高速方向)
    waypoints: [
      { lat: 29.715, lng: 118.337 },
      { lat: 29.78, lng: 118.55 }, { lat: 29.84, lng: 118.78 },
      { lat: 29.92, lng: 119.05 }, { lat: 29.98, lng: 119.30 },
      { lat: 30.05, lng: 119.55 }, { lat: 30.12, lng: 119.78 },
      { lat: 30.20, lng: 119.98 }, { lat: 30.274, lng: 120.155 }
    ],
    step: 2, direction: 1
  },
  2: { // Vehicle 2: 黄山 → 上海 (经杭州、嘉兴)
    waypoints: [
      { lat: 29.715, lng: 118.337 },
      { lat: 29.82, lng: 118.62 }, { lat: 29.93, lng: 118.90 },
      { lat: 30.05, lng: 119.28 }, { lat: 30.16, lng: 119.58 },
      { lat: 30.274, lng: 120.155 }, { lat: 30.50, lng: 120.38 },
      { lat: 30.72, lng: 120.68 }, { lat: 30.95, lng: 120.95 },
      { lat: 31.10, lng: 121.15 }, { lat: 31.23, lng: 121.35 }
    ],
    step: 7, direction: 1
  },
  3: { // Vehicle 3: 黄山 → 金华 (往南)
    waypoints: [
      { lat: 29.715, lng: 118.337 },
      { lat: 29.60, lng: 118.50 }, { lat: 29.45, lng: 118.68 },
      { lat: 29.30, lng: 118.88 }, { lat: 29.18, lng: 119.15 },
      { lat: 29.10, lng: 119.40 }, { lat: 29.08, lng: 119.65 }
    ],
    step: 4, direction: 1
  }
};

class SensorSimulator {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.anomalyState = {};
  }

  start(emitFn) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Simulator] IoT sensor simulator started');
    this.intervalId = setInterval(() => this.generateReadings(emitFn), config.SIMULATION.INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.isRunning = false;
    console.log('[Simulator] IoT sensor simulator stopped');
  }

  getNextPosition(vehicleId) {
    const route = ROUTES[vehicleId];
    if (!route) return { lat: 29.8 + Math.random() * 0.1, lng: 118.3 + Math.random() * 0.2 };

    // Move forward through waypoints, stay at destination when reached
    if (route.step < route.waypoints.length - 1) {
      route.step++;
    }
    // Stay at the last waypoint with small jitter (delivery complete / returning to depot)

    const wp = route.waypoints[route.step];
    return {
      lat: wp.lat + (Math.random() - 0.5) * 0.005,
      lng: wp.lng + (Math.random() - 0.5) * 0.005
    };
  }

  generateReadings(emitFn) {
    const db = getDB();
    try {
      const activeShipments = db.prepare(`
        SELECT s.id as shipment_id, s.vehicle_id, v.device_id, v.plate_number,
               COALESCE(MIN(o.required_temp_min), 0) as required_temp_min,
               COALESCE(MIN(o.required_temp_max), 4) as required_temp_max
        FROM shipments s
        JOIN vehicles v ON s.vehicle_id = v.id
        LEFT JOIN shipment_stops ss ON ss.shipment_id = s.id
        LEFT JOIN orders o ON ss.order_id = o.id
        WHERE s.status = 'in_transit'
        GROUP BY s.id
      `).all();

      if (!activeShipments || activeShipments.length === 0) return;

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      for (const shipment of activeShipments) {
        const { shipment_id, vehicle_id, device_id, required_temp_min, required_temp_max } = shipment;
        const tempMin = required_temp_min ?? 0;
        const tempMax = required_temp_max ?? 4;
        const targetTemp = (tempMin + tempMax) / 2;

        if (!this.anomalyState[vehicle_id]) {
          this.anomalyState[vehicle_id] = { offset: 0, stepsLeft: 0 };
        }
        const anomaly = this.anomalyState[vehicle_id];

        if (anomaly.stepsLeft <= 0 && Math.random() < config.SIMULATION.ANOMALY_CHANCE) {
          anomaly.stepsLeft = 5 + Math.floor(Math.random() * 15);
          anomaly.offset = (Math.random() > 0.5 ? 1 : -1) *
            (config.SIMULATION.ANOMALY_RANGE[0] + Math.random() * (config.SIMULATION.ANOMALY_RANGE[1] - config.SIMULATION.ANOMALY_RANGE[0]));
        }

        if (anomaly.stepsLeft > 0) {
          anomaly.stepsLeft--;
          anomaly.offset += (Math.random() - 0.5) * 0.3;
        } else {
          anomaly.offset *= 0.8;
        }

        // Get position from route
        const pos = this.getNextPosition(vehicle_id);
        const lat = pos.lat;
        const lng = pos.lng;

        const sensors = db.prepare('SELECT id, sensor_position, sensor_type FROM iot_sensors WHERE device_id = ?').all(device_id);

        for (const sensor of sensors) {
          let value;
          if (sensor.sensor_type === 'temperature') {
            const posOffset = sensor.sensor_position === 'front' ? -0.3 : sensor.sensor_position === 'rear' ? 0.3 : 0;
            value = targetTemp + anomaly.offset + posOffset + (Math.random() - 0.5) * 0.4;
          } else if (sensor.sensor_type === 'humidity') {
            value = 70 + (Math.random() - 0.5) * 10;
          } else if (sensor.sensor_type === 'door') {
            value = Math.random() < 0.03 ? 1 : 0;
          } else {
            value = 0;
          }
          value = Math.round(value * 10) / 10;
          db.prepare('INSERT INTO sensor_readings (sensor_id, vehicle_id, value, latitude, longitude, recorded_at) VALUES (?,?,?,?,?,?)').run(sensor.id, vehicle_id, value, lat, lng, now);

          if (emitFn) {
            emitFn('sensor:reading', {
              sensor_id: sensor.id, vehicle_id,
              sensor_position: sensor.sensor_position,
              sensor_type: sensor.sensor_type, value,
              latitude: lat, longitude: lng, recorded_at: now
            });
          }
        }

        if (emitFn) {
          emitFn('vehicle:position', {
            vehicle_id, plate_number: shipment.plate_number,
            latitude: lat, longitude: lng, recorded_at: now
          });
        }
      }
    } catch (err) {
      console.error('[Simulator] Error:', err.message);
    }
    try { db.save() } catch (e) { /* auto-save fallback covers this */ }
  }
}

module.exports = new SensorSimulator();
