<template>
  <div class="overview">
    <!-- KPI Cards -->
    <div class="kpi-row">
      <div class="kpi-card" v-for="kpi in kpis" :key="kpi.label" :style="{borderLeftColor: kpi.color}">
        <div class="kpi-value">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
      </div>
    </div>

    <!-- Cold Chain KPIs (from planning doc) -->
    <div class="kpi-row">
      <div class="coldchain-card">
        <div class="cc-label">温控达标率</div>
        <div class="cc-value" :style="{color: rateColor(coldchain.tempComplianceRate)}">{{ coldchain.tempComplianceRate }}%</div>
        <div class="cc-bar"><div class="cc-bar-fill cc-bar-green" :style="{width: coldchain.tempComplianceRate + '%'}"></div></div>
      </div>
      <div class="coldchain-card">
        <div class="cc-label">总库存量</div>
        <div class="cc-value" style="color:var(--color-primary)">{{ coldchain.totalStockKg }}<span class="cc-unit"> kg</span></div>
        <div class="cc-sub">在库 {{ coldchain.totalStockKg }}kg</div>
      </div>
      <div class="coldchain-card">
        <div class="cc-label">三级预警分布</div>
        <div class="cc-alerts">
          <span class="alert-dot" style="background:var(--alert-yellow)"></span>{{ alertCount('yellow') }}
          <span class="alert-dot" style="background:var(--alert-orange);margin-left:10px"></span>{{ alertCount('orange') }}
          <span class="alert-dot" style="background:var(--alert-red);margin-left:10px"></span>{{ alertCount('red') }}
        </div>
        <div class="cc-sub">共 {{ coldchain.activeAlerts }} 项未确认</div>
      </div>
      <div class="coldchain-card">
        <div class="cc-label">临期预警</div>
        <div class="cc-value" :style="{color: coldchain.expiryAlerts > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">{{ coldchain.expiryAlerts }}<span class="cc-unit"> 项</span></div>
        <div class="cc-sub">3天内到期</div>
      </div>
      <div class="coldchain-card">
        <div class="cc-label">活跃运输</div>
        <div class="cc-value" style="color:var(--color-green)">{{ coldchain.activeShipments }}<span class="cc-unit"> 单</span></div>
        <div class="cc-sub">车辆 {{ coldchain.vehiclesOnRoute }} 辆在途</div>
      </div>
    </div>

    <!-- Map + Alerts -->
    <div class="mid-row">
      <div class="map-panel">
        <div class="panel-header">车辆实时位置 <span class="panel-sub">(高德地图)</span></div>
        <div id="vehicleMap" ref="mapContainer"></div>
      </div>
      <div class="alert-panel">
        <div class="panel-header">实时告警</div>
        <div class="alert-scroll" v-if="alerts.length > 0">
          <div v-for="a in alerts" :key="a.id" class="alert-mini" :class="'alert-mini-' + a.level">
            <span class="alert-badge" :class="'badge-' + a.level">{{ levelShort(a.level) }}</span>
            <span class="alert-text">{{ a.title }}</span>
            <span class="alert-time">{{ timeAgo(a.created_at) }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无告警" :image-size="60" />
      </div>
    </div>

    <!-- Kanban -->
    <div class="kanban-row">
      <div class="panel-header">运输任务看板</div>
      <div class="kanban-grid">
        <div class="kanban-card" v-for="col in statusColumns" :key="col.status">
          <div class="kanban-dot" :style="{background: col.color}"></div>
          <div class="kanban-num">{{ col.count }}</div>
          <div class="kanban-label">{{ col.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { io } from 'socket.io-client'
import client from '../../api/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const mapContainer = ref(null)
const coldchain = reactive({ tempComplianceRate: 95, totalStockKg: 0, activeAlerts: 0, expiryAlerts: 0, activeShipments: 0, vehiclesOnRoute: 0, alertByLevel: [] })
const kpis = reactive([
  { label: '运输中', value: 0, color: '#1890ff' },
  { label: '活跃运输', value: 0, color: '#52c41a' },
  { label: '今日订单', value: 0, color: '#722ed1' },
  { label: '今日送达', value: 0, color: '#13c2c2' },
  { label: '活跃告警', value: 0, color: '#f5222d' }
])

const statusColumns = reactive([
  { label: '待规划', color: '#909399', count: 0, status: 'planned' },
  { label: '已分配', color: '#1890ff', count: 0, status: 'assigned' },
  { label: '已装车', color: '#722ed1', count: 0, status: 'loaded' },
  { label: '运输中', color: '#fa8c16', count: 0, status: 'in_transit' },
  { label: '已到达', color: '#52c41a', count: 0, status: 'arrived' },
  { label: '已完成', color: '#13c2c2', count: 0, status: 'completed' }
])

const alerts = ref([])
let map = null
const markers = new Map()
let socket = null

const rateColor = (v) => { if (v >= 95) return 'var(--color-success)'; if (v >= 85) return 'var(--color-warning)'; return 'var(--color-danger)' }
const alertCount = (level) => { const a = coldchain.alertByLevel?.find(x => x.level === level); return a?.count || 0 }
const levelShort = (l) => ({ yellow:'黄', orange:'橙', red:'红' }[l] || l)
const timeAgo = (t) => {
  if (!t) return ''
  const diff = Math.floor((Date.now() - new Date(t.replace(' ','T')).getTime()) / 60000)
  if (diff < 1) return '刚刚'
  if (diff < 60) return diff + '分钟前'
  return Math.floor(diff/60) + '小时前'
}

// WGS-84 → GCJ-02 (火星坐标) conversion for China maps
function wgs84ToGcj02(lat, lng) {
  const PI = Math.PI
  const a = 6378245.0
  const ee = 0.006693421622965943
  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
    return ret
  }
  function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
    return ret
  }
  const dLat = transformLat(lng - 105.0, lat - 35.0)
  const dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  const dLatFinal = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  const dLngFinal = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)
  return { lat: lat + dLatFinal, lng: lng + dLngFinal }
}

async function loadAll() {
  try {
    const [stats, alertData] = await Promise.all([
      client.get('/dashboard/stats'),
      client.get('/dashboard/recent-alerts')
    ])
    kpis[0].value = stats.vehiclesOnRoute
    kpis[1].value = stats.activeShipments
    kpis[2].value = stats.todayOrders
    kpis[3].value = stats.deliveredToday
    kpis[4].value = stats.activeAlerts

    // Cold chain KPIs (from planning doc)
    coldchain.tempComplianceRate = stats.tempComplianceRate || 95
    coldchain.totalStockKg = stats.totalStockKg || 0
    coldchain.activeAlerts = stats.activeAlerts || 0
    coldchain.expiryAlerts = stats.expiryAlerts || 0
    coldchain.activeShipments = stats.activeShipments || 0
    coldchain.vehiclesOnRoute = stats.vehiclesOnRoute || 0
    coldchain.alertByLevel = stats.alertByLevel || []

    // Kanban counts from stats endpoint
    if (stats.kanbanCounts) {
      for (const col of statusColumns) {
        const found = stats.kanbanCounts.find(k => k.status === col.status)
        col.count = found?.count || 0
      }
    }

    alerts.value = (alertData || []).filter(a => !a.is_acknowledged)
  } catch (e) { console.error(e) }
}

function updateMarkers(positions) {
  if (!map) return
  markers.forEach(m => map.removeLayer(m))
  markers.clear()
  const bounds = []
  for (const p of positions) {
    if (!p.latitude) continue
    const gcj = wgs84ToGcj02(p.latitude, p.longitude); bounds.push([gcj.lat, gcj.lng])
    const color = p.shipment_status === 'in_transit' ? '#1890ff' : '#909399'
    const pulseAnim = p.shipment_status === 'in_transit' ? 'vehiclePulseBlue' : 'vehiclePulseGray'
    const icon = L.divIcon({
      html: `<div style="position:relative;width:36px;height:44px;">
        <div style="width:36px;height:36px;border-radius:10px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.25);font-size:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M18 18.5a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5M6 18.5A1.5 1.5 0 1 1 4.5 17 1.5 1.5 0 0 1 6 18.5m13-5.5v-4a2 2 0 0 0-2-2h-3v8h5m-7 0V7H4a2 2 0 0 0-2 2v4h10z"/></svg>
        </div>
        <div style="position:absolute;bottom:0;left:50%;width:8px;height:8px;border-radius:50%;background:${color};animation:${pulseAnim} 2s infinite;"></div>
      </div>`,
      iconSize: [36, 44], iconAnchor: [18, 44], className: ''
    })
    const marker = L.marker([gcj.lat, gcj.lng], { icon })
      .bindPopup(`<b>${p.plate_number}</b><br>司机: ${p.driver_name||'-'}<br>状态: ${p.shipment_status||'未出车'}`)
      .addTo(map)
    markers.set(p.plate_number, marker)
  }
  if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] })
}

onMounted(async () => {
  await loadAll()
  await nextTick()

  if (mapContainer.value && !map) {
    map = L.map('vehicleMap', { attributionControl: false }).setView([wgs84ToGcj02(30.0, 119.5).lat, wgs84ToGcj02(30.0, 119.5).lng], 8)
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: ['1','2','3','4'], maxZoom: 18 }).addTo(map)

    const pos = await client.get('/dashboard/vehicle-positions')
    if (pos && pos.length > 0) updateMarkers(pos)
  }

  const token = localStorage.getItem('token')
  socket = io('/', { path: '/socket.io', auth: { token } })
  socket.on('vehicle:position', (data) => {
    const marker = markers.get(data.plate_number)
    if (marker) { const gcj2 = wgs84ToGcj02(data.latitude, data.longitude); marker.setLatLng([gcj2.lat, gcj2.lng]); }
  })
  socket.on('alert:new', (data) => { alerts.value.unshift(data); kpis[4].value++; coldchain.activeAlerts++ })
  socket.on('alert:acknowledged', () => { if (kpis[4].value > 0) kpis[4].value--; if (coldchain.activeAlerts > 0) coldchain.activeAlerts-- })
})

onUnmounted(() => { if (socket) socket.disconnect(); if (map) map.remove() })
</script>

<style>
@keyframes vehiclePulseBlue {
  0% { transform: translateX(-50%) scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(24,144,255,0.5); }
  70% { transform: translateX(-50%) scale(2.5); opacity: 0; box-shadow: 0 0 0 6px rgba(24,144,255,0); }
  100% { transform: translateX(-50%) scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(24,144,255,0); }
}
@keyframes vehiclePulseGray {
  0% { transform: translateX(-50%) scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(144,147,153,0.5); }
  70% { transform: translateX(-50%) scale(2.5); opacity: 0; box-shadow: 0 0 0 6px rgba(144,147,153,0); }
  100% { transform: translateX(-50%) scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(144,147,153,0); }
}
</style>

<style scoped>
.overview { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.kpi-row { display: flex; gap: var(--spacing-sm); }
.kpi-card { flex: 1; background: var(--bg-card); padding: var(--spacing-md); border-radius: var(--radius-md); border-left: 3px solid; box-shadow: var(--shadow-sm); }
.kpi-value { font-size: 26px; font-weight: 700; color: var(--text-primary); }
.kpi-label { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.mid-row { display: flex; gap: var(--spacing-sm); }
.map-panel { flex: 2; background: var(--bg-card); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); overflow: hidden; }
.alert-panel { flex: 1; background: var(--bg-card); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; max-height: 346px; }
.panel-header { padding: var(--spacing-sm) var(--spacing-md); font-size: 14px; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color-light); }
.panel-sub { font-size: 11px; font-weight: normal; color: var(--text-secondary); }
#vehicleMap { height: 300px; width: 100%; }
.alert-scroll { flex: 1; overflow-y: auto; padding: 4px 0; }
.alert-mini { display: flex; align-items: center; gap: var(--spacing-xs); padding: var(--spacing-xs) var(--spacing-md); transition: background .1s; }
.alert-mini:hover { background: var(--bg-hover); }
.alert-badge { font-size: 11px; color: #fff; padding: 1px 5px; border-radius: 2px; flex-shrink: 0; }
.badge-yellow { background: var(--alert-yellow); }
.badge-orange { background: var(--alert-orange); }
.badge-red { background: var(--alert-red); }
.alert-text { flex: 1; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alert-time { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }

.kanban-row { background: var(--bg-card); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.kanban-grid { display: flex; padding: var(--spacing-md); }
.kanban-card { flex: 1; text-align: center; padding: var(--spacing-xs); border-radius: var(--radius-md); cursor: default; }
.kanban-card:hover { background: var(--bg-hover); }
.kanban-dot { width: 8px; height: 8px; border-radius: 50%; margin: 0 auto var(--spacing-xs); }
.kanban-num { font-size: 24px; font-weight: 700; color: var(--text-primary); }
.kanban-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.coldchain-card { flex: 1; background: var(--bg-card); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.cc-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.cc-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
.cc-unit { font-size: 12px; font-weight: normal; color: var(--text-secondary); }
.cc-sub { font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
.cc-bar { height: 4px; background: var(--border-color-light); border-radius: 2px; margin-top: 8px; }
.cc-bar-fill { height: 100%; border-radius: 2px; transition: width 1s; }
.cc-bar-green { background: linear-gradient(90deg, var(--color-warning), var(--color-success)); }
.cc-alerts { font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; }
.alert-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
</style>
