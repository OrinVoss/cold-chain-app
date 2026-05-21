const { getDB } = require('../database/connection');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function suggestDispatches(orderIds) {
  const db = getDB();

  const placeholders = orderIds.map(() => '?').join(',');
  const orders = db.prepare(`
    SELECT o.* FROM orders o
    WHERE o.id IN (${placeholders})
      AND o.status IN ('pending','confirmed')
      AND o.id NOT IN (SELECT order_id FROM shipment_stops)
  `).all(...orderIds);

  for (const o of orders) {
    o.items = db.prepare(
      'SELECT oi.*, p.name as product_name, p.category FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?'
    ).all(o.id);
  }

  if (orders.length === 0) {
    return { plans: [], unassignableOrders: [], message: '无可派送的待处理订单' };
  }

  // Group by city
  const cityGroups = {};
  for (const o of orders) {
    if (!cityGroups[o.delivery_city]) cityGroups[o.delivery_city] = [];
    cityGroups[o.delivery_city].push(o);
  }

  // Get busy vehicle IDs
  const busyVehicles = new Set(
    db.prepare("SELECT DISTINCT vehicle_id FROM shipments WHERE status IN ('in_transit','assigned','loaded')").all().map(r => r.vehicle_id)
  );

  const allVehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
  const drivers = db.prepare("SELECT id, display_name, phone, vehicle_id FROM users WHERE role = 'driver' AND is_active = 1").all();

  function isDriverBusy(driverId) {
    const busy = db.prepare("SELECT id FROM shipments WHERE driver_id = ? AND status IN ('in_transit','assigned','loaded')").get(driverId);
    return !!busy;
  }

  function buildPlanGroup(orders, city, groupIdx) {
    const totalWeight = orders.reduce((s, o) => s + (o.total_weight_kg || 0), 0);
    const tempMin = Math.max(...orders.map(o => o.required_temp_min));
    const tempMax = Math.min(...orders.map(o => o.required_temp_max));

    // Vehicle matching
    let bestVehicle = null;
    let bestScore = -999;
    const hasSensitive = orders.some(o => o.required_temp_max <= 2);

    for (const v of allVehicles) {
      if (busyVehicles.has(v.id)) continue;
      if (v.max_load_kg < totalWeight) continue;
      let score = 0;
      if (hasSensitive && v.vehicle_type === 'refrigerated') score += 20;
      if (!hasSensitive && v.vehicle_type === 'insulated') score += 5;
      const margin = (v.max_load_kg - totalWeight) / v.max_load_kg;
      if (margin > 0.3) score += 10;
      else if (margin < 0.05) score -= 5;
      if (score > bestScore) { bestScore = score; bestVehicle = v; }
    }

    // Driver matching
    let bestDriver = null;
    if (bestVehicle) {
      bestDriver = drivers.find(d => d.vehicle_id === bestVehicle.id && !isDriverBusy(d.id));
    }

    // Nearest-neighbor stop sequencing from 黄山 origin
    const origin = { lat: 29.715, lng: 118.337 };
    const stops = orders.map(o => ({
      order_id: o.id,
      customer_name: o.customer_name,
      lat: o.delivery_lat || origin.lat,
      lng: o.delivery_lng || origin.lng
    }));
    const optimized = [];
    const remaining = [...stops];
    let current = origin;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }
      const chosen = remaining.splice(nearestIdx, 1)[0];
      optimized.push({
        ...chosen,
        sequence: optimized.length + 1,
        distance_from_prev_km: Math.round(nearestDist * 10) / 10
      });
      current = { lat: chosen.lat, lng: chosen.lng };
    }

    const cityName = city === 'shanghai' ? '上海' : city === 'hangzhou' ? '杭州' : city;
    return {
      groupIndex: groupIdx,
      reason: `目的地${cityName}，温区${tempMin}~${tempMax}°C，总重${totalWeight}kg`,
      orders,
      totalWeight,
      tempRange: { min: tempMin, max: tempMax },
      suggestedVehicle: bestVehicle,
      suggestedDriver: bestDriver,
      matchScore: bestVehicle ? Math.min(bestScore + 70, 100) : 0,
      optimizedStops: optimized
    };
  }

  const plans = [];
  let groupIdx = 0;

  for (const [city, cityOrders] of Object.entries(cityGroups)) {
    cityOrders.sort((a, b) => a.required_temp_min - b.required_temp_min);

    let currentGroup = [];
    let groupMin = 0, groupMax = 999, groupWeight = 0;

    for (const o of cityOrders) {
      const w = o.total_weight_kg || 0;
      const newMin = currentGroup.length === 0 ? o.required_temp_min : Math.max(groupMin, o.required_temp_min);
      const newMax = currentGroup.length === 0 ? o.required_temp_max : Math.min(groupMax, o.required_temp_max);

      if (currentGroup.length > 0 && (newMin > newMax || groupWeight + w > 3000)) {
        plans.push(buildPlanGroup(currentGroup, city, ++groupIdx));
        currentGroup = [];
        groupMin = 0; groupMax = 999; groupWeight = 0;
      }

      currentGroup.push(o);
      groupMin = currentGroup.length === 1 ? o.required_temp_min : Math.max(groupMin, o.required_temp_min);
      groupMax = currentGroup.length === 1 ? o.required_temp_max : Math.min(groupMax, o.required_temp_max);
      groupWeight += w;
    }
    if (currentGroup.length > 0) {
      plans.push(buildPlanGroup(currentGroup, city, ++groupIdx));
    }
  }

  const assignedIds = new Set(plans.flatMap(p => p.orders.map(o => o.id)));
  const unassignable = orders.filter(o => !assignedIds.has(o.id)).map(o => ({
    order: o,
    reason: '无可匹配的车辆或温区不兼容'
  }));

  return { plans, unassignableOrders: unassignable, message: plans.length > 0 ? null : '无可用车辆匹配' };
}

function executeDispatch(plan, reqUser) {
  const db = getDB();
  const results = [];

  for (const group of plan.groups) {
    const { order_ids, vehicle_id, driver_id, optimizedStops } = group;
    const date = new Date().toISOString().substring(0, 10).replace(/-/g, '');
    const countAll = db.prepare("SELECT COUNT(*) as c FROM shipments WHERE date(created_at) = date('now','localtime')").get();
    const code = `SHP-${date}-${String((countAll?.c || 0) + 1).padStart(3, '0')}`;

    let totalWeight = 0;
    for (const oid of order_ids) {
      const items = db.prepare('SELECT SUM(quantity_kg) as w FROM order_items WHERE order_id = ?').get(oid);
      totalWeight += (items?.w || 0);
    }

    db.prepare('INSERT INTO shipments (shipment_code, vehicle_id, driver_id, total_weight_kg, route_order, status) VALUES (?,?,?,?,?,?)')
      .run(code, vehicle_id || null, driver_id || null, totalWeight, JSON.stringify(order_ids), vehicle_id ? 'assigned' : 'planned');

    const result = db.prepare('SELECT last_insert_rowid() as id').get();
    const shipmentId = result.id;

    const stopOrderIds = optimizedStops ? optimizedStops.map(s => s.order_id) : order_ids;
    stopOrderIds.forEach((oid, i) => {
      const estArrival = new Date(Date.now() + (i + 1) * 7200000).toISOString().replace('T', ' ').substring(0, 16);
      db.prepare('INSERT INTO shipment_stops (shipment_id, order_id, stop_sequence, estimated_arrival) VALUES (?,?,?,?)')
        .run(shipmentId, oid, i + 1, estArrival);
      db.prepare("UPDATE orders SET status = 'processing' WHERE id = ?").run(oid);
    });

    results.push({ shipmentId, shipmentCode: code });
  }

  db.save();
  return results;
}

module.exports = { suggestDispatches, executeDispatch };
