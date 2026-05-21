const bcrypt = require('bcryptjs');
const { getDB } = require('./connection');

function seed() {
  const db = getDB();

  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing && existing.count > 0) {
    console.log('[Seed] Database already seeded, skipping');
    return;
  }

  console.log('[Seed] Seeding demo data...');

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // === Users ===
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('admin', hash('admin123'), '沈俊杰', 'admin', '13800000001', null);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('warehouse', hash('123456'), '李明', 'warehouse', '13800000002', null);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('driver1', hash('123456'), '张师傅', 'driver', '13800000003', 1);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('driver2', hash('123456'), '王师傅', 'driver', '13800000004', 2);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('driver3', hash('123456'), '赵师傅', 'driver', '13800000005', 3);
  db.prepare('INSERT INTO users (username, password_hash, display_name, role, phone, vehicle_id) VALUES (?,?,?,?,?,?)').run('viewer', hash('123456'), '陈心瑶', 'viewer', '13800000006', null);

  // === Vehicles ===
  db.prepare("INSERT INTO vehicles (plate_number, vehicle_type, brand_model, max_load_kg, device_id) VALUES (?,?,?,?,?)").run('皖J-12345', 'refrigerated', '福田欧马可 4.2m', 3000, 'DEV-001');
  db.prepare("INSERT INTO vehicles (plate_number, vehicle_type, brand_model, max_load_kg, device_id) VALUES (?,?,?,?,?)").run('皖J-12346', 'refrigerated', '福田欧马可 4.2m', 3000, 'DEV-002');
  db.prepare("INSERT INTO vehicles (plate_number, vehicle_type, brand_model, max_load_kg, device_id) VALUES (?,?,?,?,?)").run('皖J-12347', 'refrigerated', '江淮骏铃 4.2m', 2500, 'DEV-003');
  db.prepare("INSERT INTO vehicles (plate_number, vehicle_type, brand_model, max_load_kg, device_id) VALUES (?,?,?,?,?)").run('皖J-22345', 'insulated', '五菱荣光 3.0m', 1500, 'DEV-004');
  db.prepare("INSERT INTO vehicles (plate_number, vehicle_type, brand_model, max_load_kg, device_id) VALUES (?,?,?,?,?)").run('皖J-22346', 'insulated', '长安睿行 3.0m', 1200, 'DEV-005');

  // === IoT Sensors (3 temp + 1 humidity + 1 door per vehicle) ===
  const devices = ['DEV-001','DEV-002','DEV-003','DEV-004','DEV-005'];
  for (const dev of devices) {
    db.prepare("INSERT INTO iot_sensors (device_id, sensor_position, sensor_type) VALUES (?,?,?)").run(dev, 'front', 'temperature');
    db.prepare("INSERT INTO iot_sensors (device_id, sensor_position, sensor_type) VALUES (?,?,?)").run(dev, 'middle', 'temperature');
    db.prepare("INSERT INTO iot_sensors (device_id, sensor_position, sensor_type) VALUES (?,?,?)").run(dev, 'rear', 'temperature');
    db.prepare("INSERT INTO iot_sensors (device_id, sensor_position, sensor_type) VALUES (?,?,?)").run(dev, 'middle', 'humidity');
    db.prepare("INSERT INTO iot_sensors (device_id, sensor_position, sensor_type) VALUES (?,?,?)").run(dev, 'rear', 'door');
  }

  // === Products ===
  const products = [
    ['TS-MF-001', '黄山毛峰', 'tea', 0, 8, 365],
    ['VG-QC-001', '有机青菜', 'vegetable', 0, 4, 5],
    ['VG-BC-001', '大白菜', 'vegetable', 0, 4, 10],
    ['VG-TD-001', '黄山竹笋', 'vegetable', 0, 4, 7],
    ['FR-HT-001', '红心猕猴桃', 'fruit', 0, 4, 14],
    ['MT-ZR-001', '徽州土猪肉', 'meat', 0, 2, 7],
    ['MT-RG-001', '土猪肉香肠', 'meat', 0, 4, 30],
    ['VG-JD-001', '农家土鸡蛋', 'other', 0, 4, 14]
  ];
  for (const p of products) {
    db.prepare("INSERT INTO products (sku_code, name, category, storage_temp_min, storage_temp_max, shelf_life_days) VALUES (?,?,?,?,?,?)").run(...p);
  }

  // === Orders ===
  const orders = [
    { no: 'ORD-20260510-001', cust: '上海美食汇餐厅', phone: '021-58880001', addr: '上海市浦东新区陆家嘴环路1000号', city: 'shanghai', lat: 31.2397, lng: 121.4997, tmin: 0, tmax: 4, wt: 150, stat: 'pending' },
    { no: 'ORD-20260510-002', cust: '杭州西湖大酒店', phone: '0571-86660001', addr: '杭州市西湖区北山路78号', city: 'hangzhou', lat: 30.2574, lng: 120.1449, tmin: 0, tmax: 4, wt: 200, stat: 'confirmed' },
    { no: 'ORD-20260510-003', cust: '上海盒马鲜生(长宁店)', phone: '021-62220001', addr: '上海市长宁区天山路762号', city: 'shanghai', lat: 31.2168, lng: 121.4067, tmin: 0, tmax: 4, wt: 300, stat: 'confirmed' },
    { no: 'ORD-20260509-001', cust: '杭州联华超市(西湖店)', phone: '0571-85120001', addr: '杭州市上城区庆春路86号', city: 'hangzhou', lat: 30.2590, lng: 120.1702, tmin: 0, tmax: 4, wt: 180, stat: 'in_transit' },
    { no: 'ORD-20260509-002', cust: '上海永辉超市(松江店)', phone: '021-57640001', addr: '上海市松江区新松江路925号', city: 'shanghai', lat: 31.0350, lng: 121.2320, tmin: 0, tmax: 2, wt: 120, stat: 'in_transit' },
    { no: 'ORD-20260509-003', cust: '杭州外婆家(总店)', phone: '0571-87920001', addr: '杭州市拱墅区湖墅南路198号', city: 'hangzhou', lat: 30.2908, lng: 120.1526, tmin: 0, tmax: 4, wt: 250, stat: 'in_transit' },
    { no: 'ORD-20260508-001', cust: '上海大润发(杨浦店)', phone: '021-65430001', addr: '上海市杨浦区黄兴路1616号', city: 'shanghai', lat: 31.2768, lng: 121.5279, tmin: 0, tmax: 4, wt: 400, stat: 'delivered' },
    { no: 'ORD-20260508-002', cust: '杭州物美超市(下沙店)', phone: '0571-86930001', addr: '杭州市钱塘区下沙街道学源街258号', city: 'hangzhou', lat: 30.3100, lng: 120.3570, tmin: 0, tmax: 4, wt: 160, stat: 'delivered' },
    { no: 'ORD-20260511-001', cust: '上海丰收日餐厅(徐汇店)', phone: '021-64380001', addr: '上海市徐汇区漕溪北路339号', city: 'shanghai', lat: 31.1899, lng: 121.4325, tmin: 0, tmax: 4, wt: 100, stat: 'pending' },
    { no: 'ORD-20260511-002', cust: '杭州绿茶餐厅(龙井店)', phone: '0571-86820001', addr: '杭州市西湖区龙井路89号', city: 'hangzhou', lat: 30.2334, lng: 120.1203, tmin: 0, tmax: 4, wt: 130, stat: 'pending' },
    { no: 'ORD-20260507-003', cust: '上海山姆会员店(青浦店)', phone: '021-69780001', addr: '上海市青浦区赵巷镇嘉松中路6888号', city: 'shanghai', lat: 31.1506, lng: 121.2012, tmin: 0, tmax: 2, wt: 500, stat: 'delivered' }
  ];

  const productIds = db.prepare('SELECT id FROM products').all();
  for (const o of orders) {
    db.prepare('INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_city, delivery_lat, delivery_lng, required_temp_min, required_temp_max, total_weight_kg, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(o.no, o.cust, o.phone, o.addr, o.city, o.lat, o.lng, o.tmin, o.tmax, o.wt, o.stat);
    const orderId = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(o.no).id;
    const count = 1 + Math.floor(Math.random() * 3);
    let remaining = o.wt;
    for (let i = 0; i < count; i++) {
      const p = productIds[Math.floor(Math.random() * productIds.length)];
      const qty = Math.min(Math.floor(remaining / (count - i)) + Math.floor(Math.random() * 20), remaining);
      if (qty > 0) {
        db.prepare('INSERT INTO order_items (order_id, product_id, quantity_kg) VALUES (?,?,?)').run(orderId, p.id, qty);
        remaining -= qty;
      }
    }
  }

  // === Shipments ===
  db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, origin_lat, origin_lng, status, total_weight_kg, route_order) VALUES (?,?,?,?,?,?,?,?)').run('SHP-20260510-001', 1, 3, 29.715, 118.337, 'in_transit', 430, '[4,6]');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(1, 4, 1, '2026-05-09 10:30', 'arrived');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(1, 6, 2, '2026-05-09 12:00', 'pending');

  db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, origin_lat, origin_lng, status, total_weight_kg, route_order) VALUES (?,?,?,?,?,?,?,?)').run('SHP-20260510-002', 2, 4, 29.715, 118.337, 'in_transit', 120, '[5]');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(2, 5, 1, '2026-05-09 14:00', 'pending');

  db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, origin_lat, origin_lng, status, total_weight_kg, route_order) VALUES (?,?,?,?,?,?,?,?)').run('SHP-20260510-003', 3, 5, 29.715, 118.337, 'in_transit', 200, '[2]');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(3, 2, 1, '2026-05-09 09:00', 'pending');

  db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, origin_lat, origin_lng, status, total_weight_kg, route_order) VALUES (?,?,?,?,?,?,?,?)').run('SHP-20260508-001', 1, 3, 29.715, 118.337, 'completed', 560, '[7,8]');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(4, 7, 1, '2026-05-08 10:00', 'delivered');
  db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival, status) VALUES (?,?,?,?,?)').run(4, 8, 2, '2026-05-08 14:30', 'delivered');

  // === Historical sensor readings for 3 vehicles ===
  const now = new Date();
  const vehicleRoutes = [
    { vid: 1, sensors: [1,2,3], progress: 0.30, dlat: 0.457, dlng: 1.845 },
    { vid: 2, sensors: [6,7,8], progress: 0.65, dlat: 1.417, dlng: 3.107 },
    { vid: 3, sensors: [11,12,13], progress: 0.50, dlat: -0.635, dlng: 1.313 }
  ];
  for (let t = 120; t >= 0; t -= 0.5) {
    const time = new Date(now - t * 60000).toISOString().replace('T', ' ').substring(0, 19);
    for (const vr of vehicleRoutes) {
      const p = vr.progress + (120 - t) / 120 * 0.03;
      const lat = 29.715 + p * vr.dlat;
      const lng = 118.337 + p * vr.dlng;
      for (const sid of vr.sensors) {
        const tval = vr.vid === 2 && t < 60 ? 3.5 + Math.random() * 3 : 2.0 + Math.random() * 1.5;
        db.prepare('INSERT INTO sensor_readings (sensor_id, vehicle_id, value, latitude, longitude, recorded_at) VALUES (?,?,?,?,?,?)').run(sid, vr.vid, +tval.toFixed(1), lat, lng, time);
      }
    }
  }

  // === Inventory Transactions ===
  const nowDate = new Date();
  const fmtDate = (d) => d.toISOString().substring(0, 10).replace(/-/g, '');
  const daysAgo = (n) => { const d = new Date(nowDate - n * 86400000); return d.toISOString().substring(0, 10); };
  // Stock-in: each product received multiple batches
  const inventoryIns = [
    { pid: 1, qty: 500, batch: daysAgo(30), ref: 'manual', note: '春茶采收入库' },     // 黄山毛峰, shelf_life=365
    { pid: 2, qty: 200, batch: daysAgo(4), ref: 'manual', note: '青菜采收入库' },       // 有机青菜, shelf_life=5 → 临期!
    { pid: 3, qty: 300, batch: daysAgo(6), ref: 'manual', note: '大白菜采收入库' },     // 大白菜, shelf_life=10
    { pid: 4, qty: 150, batch: daysAgo(5), ref: 'manual', note: '竹笋采收入库' },       // 黄山竹笋, shelf_life=7 → 临期!
    { pid: 5, qty: 350, batch: daysAgo(8), ref: 'manual', note: '猕猴桃采收入库' },     // 红心猕猴桃, shelf_life=14
    { pid: 6, qty: 250, batch: daysAgo(2), ref: 'manual', note: '土猪肉入库' },         // 徽州土猪肉, shelf_life=7
    { pid: 7, qty: 400, batch: daysAgo(20), ref: 'manual', note: '香肠入库' },          // 土猪肉香肠, shelf_life=30
    { pid: 8, qty: 600, batch: daysAgo(3), ref: 'manual', note: '土鸡蛋入库' },         // 农家土鸡蛋, shelf_life=14
    { pid: 1, qty: 200, batch: daysAgo(5), ref: 'manual', note: '春茶二批入库' },
    { pid: 2, qty: 180, batch: daysAgo(1), ref: 'manual', note: '青菜二批入库' },
    { pid: 6, qty: 150, batch: daysAgo(5), ref: 'manual', note: '土猪肉二批入库' },     // shelf_life=7, batch 5天前 → 临期!
  ];
  for (const t of inventoryIns) {
    db.prepare('INSERT INTO inventory_transactions (product_id, type, quantity_kg, reference_type, notes, batch_date) VALUES (?,?,?,?,?,?)').run(t.pid, 'in', t.qty, t.ref, t.note, t.batch);
  }
  // Stock-out: some products shipped out for delivered orders
  const inventoryOuts = [
    { pid: 1, qty: 60, ref: 'order', rid: 7, note: '上海大润发订单出库' },
    { pid: 3, qty: 80, ref: 'order', rid: 7, note: '上海大润发订单出库' },
    { pid: 6, qty: 90, ref: 'order', rid: 7, note: '上海大润发订单出库' },
    { pid: 7, qty: 60, ref: 'order', rid: 7, note: '上海大润发订单出库' },
    { pid: 8, qty: 110, ref: 'order', rid: 7, note: '上海大润发订单出库' },
    { pid: 2, qty: 40, ref: 'order', rid: 8, note: '杭州物美订单出库' },
    { pid: 4, qty: 35, ref: 'order', rid: 8, note: '杭州物美订单出库' },
    { pid: 5, qty: 85, ref: 'order', rid: 8, note: '杭州物美订单出库' },
    { pid: 3, qty: 100, ref: 'order', rid: 11, note: '上海山姆订单出库' },
    { pid: 6, qty: 150, ref: 'order', rid: 11, note: '上海山姆订单出库' },
    { pid: 7, qty: 150, ref: 'order', rid: 11, note: '上海山姆订单出库' },
    { pid: 1, qty: 100, ref: 'order', rid: 11, note: '上海山姆订单出库' },
  ];
  for (const t of inventoryOuts) {
    db.prepare('INSERT INTO inventory_transactions (product_id, type, quantity_kg, reference_type, reference_id, notes, batch_date) VALUES (?,?,?,?,?,?,?)').run(t.pid, 'out', t.qty, t.ref, t.rid, t.note, null);
  }

  db.save();
  console.log('[Seed] Demo data seeded successfully');
}

module.exports = seed;
