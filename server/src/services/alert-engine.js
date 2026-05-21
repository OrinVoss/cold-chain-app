const { getDB } = require('../database/connection');
const config = require('../config');

class AlertEngine {
  evaluate(reading, emitFn) {
    if (reading.sensor_type !== 'temperature') return;

    const db = getDB();
    try {
      const shipment = db.prepare(`
        SELECT s.id as shipment_id, o.required_temp_max
        FROM shipments s
        LEFT JOIN shipment_stops ss ON ss.shipment_id = s.id
        LEFT JOIN orders o ON ss.order_id = o.id
        WHERE s.vehicle_id = ? AND s.status = 'in_transit'
        ORDER BY o.required_temp_max ASC LIMIT 1
      `).get(reading.vehicle_id);

      const threshold = shipment?.required_temp_max ?? 4;
      const deviation = reading.value - threshold;

      if (deviation <= config.ALERT.YELLOW) return;

      let level, title;
      if (deviation >= config.ALERT.RED) {
        level = 'red'; title = '严重温度预警 - 温度严重超标';
      } else if (deviation >= config.ALERT.ORANGE) {
        level = 'orange'; title = '温度偏高警告 - 请立即检查';
      } else {
        level = 'yellow'; title = '温度轻微偏离提醒';
      }

      const vehicle = db.prepare('SELECT plate_number FROM vehicles WHERE id = ?').get(reading.vehicle_id);
      const posLabel = { front: '前部', middle: '中部', rear: '后部' };
      const pos = posLabel[reading.sensor_position] || reading.sensor_position;
      const message = `车辆 ${vehicle?.plate_number || '未知'} ${pos}温度 ${reading.value}°C，超出阈值 ${deviation.toFixed(1)}°C`;

      // Check duplicate
      const recent = db.prepare("SELECT id FROM alerts WHERE vehicle_id = ? AND sensor_id = ? AND level = ? AND created_at > datetime('now','-5 minutes','localtime')").get(reading.vehicle_id, reading.sensor_id, level);
      if (recent) return;

      db.prepare('INSERT INTO alerts (vehicle_id, shipment_id, sensor_id, level, title, message, deviation) VALUES (?,?,?,?,?,?,?)').run(reading.vehicle_id, shipment?.shipment_id || null, reading.sensor_id, level, title, message, Math.round(deviation * 10) / 10);
      try { db.save() } catch (e) { /* save fallback */ }

      const result = db.prepare('SELECT last_insert_rowid() as id').get();

      const plateNumber = vehicle?.plate_number || null;
      const alert = {
        id: result.id, vehicle_id: reading.vehicle_id,
        shipment_id: shipment?.shipment_id || null, sensor_id: reading.sensor_id,
        level, title, message, plate_number: plateNumber,
        deviation: Math.round(deviation * 10) / 10,
        is_acknowledged: 0,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      if (emitFn) emitFn('alert:new', alert);
    } catch (err) {
      console.error('[AlertEngine] Error:', err.message);
    }
  }
}

module.exports = new AlertEngine();
