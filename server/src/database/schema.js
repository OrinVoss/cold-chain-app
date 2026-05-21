const { initDB, getDB } = require('./connection');

async function initSchema() {
  const db = await initDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','warehouse','driver','viewer')),
      phone TEXT,
      vehicle_id INTEGER,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_number TEXT NOT NULL UNIQUE,
      vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('refrigerated','insulated')),
      brand_model TEXT,
      max_load_kg REAL DEFAULT 3000,
      device_id TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS iot_sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      sensor_position TEXT NOT NULL CHECK(sensor_position IN ('front','middle','rear')),
      sensor_type TEXT NOT NULL CHECK(sensor_type IN ('temperature','humidity','door')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      value REAL NOT NULL,
      latitude REAL,
      longitude REAL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('tea','vegetable','fruit','meat','other')),
      storage_temp_min REAL DEFAULT 0,
      storage_temp_max REAL DEFAULT 4,
      shelf_life_days INTEGER DEFAULT 7,
      unit TEXT DEFAULT 'kg',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      delivery_address TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_lat REAL,
      delivery_lng REAL,
      required_temp_min REAL DEFAULT 0,
      required_temp_max REAL DEFAULT 4,
      total_weight_kg REAL DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','processing','in_transit','delivered','cancelled')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity_kg REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_code TEXT NOT NULL UNIQUE,
      vehicle_id INTEGER,
      driver_id INTEGER,
      origin_city TEXT DEFAULT '黄山',
      origin_lat REAL DEFAULT 29.8,
      origin_lng REAL DEFAULT 118.3,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','assigned','loaded','in_transit','arrived','completed','exception')),
      total_weight_kg REAL DEFAULT 0,
      route_order TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS shipment_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      stop_sequence INTEGER NOT NULL,
      estimated_arrival TEXT,
      actual_arrival TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','arrived','delivered')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      shipment_id INTEGER,
      sensor_id INTEGER,
      reading_id INTEGER,
      level TEXT NOT NULL CHECK(level IN ('yellow','orange','red')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      deviation REAL DEFAULT 0,
      is_acknowledged INTEGER DEFAULT 0,
      acknowledged_by INTEGER,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in','out')),
      quantity_kg REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      batch_date TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.save();
  console.log('[DB] Schema initialized successfully');
}

module.exports = initSchema;
