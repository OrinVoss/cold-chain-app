const { getDB } = require('../database/connection');

function getDashboard() {
  const db = getDB();
  const totalIn = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type='in'").get();
  const totalOut = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type='out'").get();
  const today = new Date().toISOString().substring(0, 10);
  const todayIn = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type='in' AND date(created_at) = ?").get(today);
  const todayOut = db.prepare("SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE type='out' AND date(created_at) = ?").get(today);
  const productCount = db.prepare(`
    SELECT COUNT(DISTINCT product_id) as c FROM inventory_transactions
    WHERE product_id IN (SELECT product_id FROM inventory_transactions GROUP BY product_id HAVING SUM(CASE WHEN type='in' THEN quantity_kg ELSE -quantity_kg END) > 0)
  `).get();
  const alerts = getExpiryAlerts(3);

  return {
    totalStockKg: totalIn.total - totalOut.total,
    totalProducts: productCount?.c || 0,
    expiryAlerts: alerts.length,
    todayInKg: todayIn.total,
    todayOutKg: todayOut.total
  };
}

function getInventory() {
  const db = getDB();
  return db.prepare(`
    SELECT p.id, p.sku_code, p.name, p.category, p.storage_temp_min, p.storage_temp_max, p.shelf_life_days, p.unit,
      COALESCE(ins.total, 0) - COALESCE(outs.total, 0) as current_stock
    FROM products p
    LEFT JOIN (SELECT product_id, SUM(quantity_kg) as total FROM inventory_transactions WHERE type='in' GROUP BY product_id) ins ON p.id = ins.product_id
    LEFT JOIN (SELECT product_id, SUM(quantity_kg) as total FROM inventory_transactions WHERE type='out' GROUP BY product_id) outs ON p.id = outs.product_id
    WHERE current_stock > 0
    ORDER BY p.category, p.name
  `).all();
}

function getExpiryAlerts(daysThreshold) {
  const db = getDB();
  const today = new Date();
  const products = getInventory();

  const alerts = [];
  for (const p of products) {
    const batches = db.prepare(`
      SELECT batch_date, quantity_kg FROM inventory_transactions
      WHERE product_id = ? AND type = 'in' AND batch_date IS NOT NULL
      ORDER BY batch_date ASC
    `).all(p.id);

    const totalOut = db.prepare(
      'SELECT COALESCE(SUM(quantity_kg), 0) as total FROM inventory_transactions WHERE product_id = ? AND type = ?'
    ).get(p.id, 'out').total;

    let cumulativeIn = 0;
    let remainingOut = totalOut;
    for (const b of batches) {
      cumulativeIn += b.quantity_kg;
      const consumedFromBatch = Math.min(b.quantity_kg, remainingOut);
      const batchRemaining = b.quantity_kg - consumedFromBatch;
      remainingOut -= consumedFromBatch;

      if (batchRemaining > 0) {
        const batchDate = new Date(b.batch_date);
        const expiryDate = new Date(batchDate.getTime() + p.shelf_life_days * 86400000);
        const daysRemaining = Math.ceil((expiryDate - today) / 86400000);
        if (daysRemaining <= daysThreshold) {
          alerts.push({
            product_id: p.id,
            product_name: p.name,
            sku_code: p.sku_code,
            category: p.category,
            shelf_life_days: p.shelf_life_days,
            batch_date: b.batch_date,
            batch_quantity: b.quantity_kg,
            quantity_at_risk: Math.min(batchRemaining, b.quantity_kg),
            days_remaining: daysRemaining,
            level: daysRemaining <= 0 ? 'red' : daysRemaining <= 1 ? 'orange' : 'yellow'
          });
        }
        break;
      }
    }
  }

  return alerts.sort((a, b) => a.days_remaining - b.days_remaining);
}

function stockIn(productId, quantityKg, notes) {
  const db = getDB();
  const today = new Date().toISOString().substring(0, 10);
  db.prepare('INSERT INTO inventory_transactions (product_id, type, quantity_kg, reference_type, notes, batch_date) VALUES (?,?,?,?,?,?)')
    .run(productId, 'in', quantityKg, 'manual', notes || '', today);
  db.save();
  return db.prepare('SELECT last_insert_rowid() as id').get();
}

function stockOut(productId, quantityKg, referenceType, referenceId, notes) {
  const db = getDB();
  db.prepare('INSERT INTO inventory_transactions (product_id, type, quantity_kg, reference_type, reference_id, notes) VALUES (?,?,?,?,?,?)')
    .run(productId, 'out', quantityKg, referenceType || 'manual', referenceId || null, notes || '');
  db.save();
  return db.prepare('SELECT last_insert_rowid() as id').get();
}

function getTransactions(limit) {
  const db = getDB();
  return db.prepare(`
    SELECT t.*, p.name as product_name, p.sku_code
    FROM inventory_transactions t JOIN products p ON t.product_id = p.id
    ORDER BY t.created_at DESC LIMIT ?
  `).all(limit || 50);
}

module.exports = { getDashboard, getInventory, getExpiryAlerts, stockIn, stockOut, getTransactions };
