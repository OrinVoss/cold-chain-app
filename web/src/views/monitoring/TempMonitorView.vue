<template>
  <div class="monitoring">
    <div class="toolbar">
      <el-select v-model="selectedVehicle" placeholder="选择车辆" clearable @change="onVehicleChange" style="width:200px">
        <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number + ' (' + v.vehicle_type + ')'" :value="v.id" />
      </el-select>
      <el-button type="warning" @click="injectAlert" :disabled="!selectedVehicle">注入温度异常 (演示)</el-button>
      <span class="sim-status">模拟器运行中，每3秒生成数据</span>
    </div>

    <el-row :gutter="16" style="margin-top:var(--spacing-sm)">
      <el-col :span="8" v-for="s in displaySensors" :key="s.id">
        <div class="sensor-card" :class="'sensor-' + alertLevel(s.latest_value)">
          <div class="sensor-header">
            <span class="sensor-vehicle">{{ s.plate_number }}</span>
            <span class="sensor-pos">{{ positionLabel(s.sensor_position) }}</span>
          </div>
          <div class="sensor-temp">{{ s.latest_value != null ? s.latest_value + '°C' : '--' }}</div>
          <div class="sensor-meta">温度传感器 · {{ s.latest_time ? formatTime(s.latest_time) : '无数据' }}</div>
          <div class="sensor-bar"><div class="sensor-bar-fill" :style="{width: barPercent(s.latest_value) + '%', background: barColor(s.latest_value)}"></div></div>
        </div>
      </el-col>
    </el-row>

    <!-- Alert Level Summary (from planning doc §4.2.1 三级预警) -->
    <el-row :gutter="16" style="margin-top:var(--spacing-sm)">
      <el-col :span="8">
        <div class="alert-summary-card alert-summary-yellow">
          <div class="as-icon">⚠</div>
          <div class="as-body">
            <div class="as-count">{{ alertCounts.yellow }}</div>
            <div class="as-label">黄色预警</div>
            <div class="as-desc">偏差 0.5-1.5°C · 推送司机APP</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="alert-summary-card alert-summary-orange">
          <div class="as-icon">🔶</div>
          <div class="as-body">
            <div class="as-count">{{ alertCounts.orange }}</div>
            <div class="as-label">橙色预警</div>
            <div class="as-desc">偏差 1.5-2.5°C · 通知调度中心</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="alert-summary-card alert-summary-red">
          <div class="as-icon">🔴</div>
          <div class="as-body">
            <div class="as-count">{{ alertCounts.red }}</div>
            <div class="as-label">红色预警</div>
            <div class="as-desc">偏差 >2.5°C · 应急调度启动</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="chart-card" style="margin-top:var(--spacing-sm)">
      <div class="chart-header">实时温度曲线</div>
      <div ref="chartRef" class="chart-box"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'
import client from '../../api/client'
import * as echarts from 'echarts'

const selectedVehicle = ref(null)
const vehicles = ref([])
const allSensors = ref([])
const chartRef = ref(null)
let chart = null
let socket = null
const chartData = ref({})
const alertCounts = ref({ yellow: 0, orange: 0, red: 0 })

const positionLabel = (p) => ({ front: '前部', middle: '中部', rear: '后部' }[p] || p)

const displaySensors = computed(() => {
  if (selectedVehicle.value) return allSensors.value.filter(s => s.vehicle_id === selectedVehicle.value)
  return allSensors.value.filter(s => s.latest_value != null).slice(0, 9)
})

const alertLevel = (v) => {
  if (v == null) return 'none'
  if (v > 6.5) return 'red'; if (v > 5.5) return 'orange'; if (v > 4.5) return 'yellow'
  return 'ok'
}

const barPercent = (v) => v != null ? Math.min(100, Math.max(0, (v / 10) * 100)) : 0

const barColor = (v) => {
  if (v == null) return '#909399'
  if (v > 6.5) return '#f5222d'; if (v > 5.5) return '#fa8c16'; if (v > 4.5) return '#e6a23c'
  return '#52c41a'
}

const formatTime = (t) => t ? t.substring(11, 19) : ''

async function loadSensors() {
  try { const res = await client.get('/sensors'); allSensors.value = res; const vSet = new Map(); for (const s of res) { if (!vSet.has(s.vehicle_id)) vSet.set(s.vehicle_id, { id: s.vehicle_id, plate_number: s.plate_number, vehicle_type: s.vehicle_type }) } vehicles.value = [...vSet.values()] } catch (e) { console.error(e) } }

function onVehicleChange() {
  if (selectedVehicle.value) loadVehicleChart(selectedVehicle.value)
  else initChart()
}

async function loadVehicleChart(vehicleId) {
  const sensors = allSensors.value.filter(s => s.vehicle_id === vehicleId)
  for (const s of sensors) {
    const res = await client.get(`/sensors/${s.id}/readings?limit=60`)
    chartData.value[s.id] = res.map(r => ({ time: r.recorded_at?.substring(11,19) || '', value: r.value }))
  }
  initChart()
}

function initChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)

  const sensorIds = selectedVehicle.value
    ? allSensors.value.filter(s => s.vehicle_id === selectedVehicle.value).map(s => s.id)
    : allSensors.value.filter(s => s.latest_value != null).slice(0, 6).map(s => s.id)

  if (sensorIds.length === 0) return

  const series = sensorIds.map(id => {
    const sensor = allSensors.value.find(s => s.id === id)
    const data = chartData.value[id] || []
    return {
      name: (sensor?.plate_number||'') + '-' + positionLabel(sensor?.sensor_position||''),
      type: 'line', data: data.map(d => d.value), smooth: true,
      symbol: 'none', lineStyle: { width: 2 }
    }
  })

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 16, right: 16, bottom: 36, left: 44 },
    xAxis: { type: 'category', data: chartData.value[sensorIds[0]]?.map(d => d.time) || [], boundaryGap: false },
    yAxis: { type: 'value', name: '°C', min: 0, max: 12, splitLine: { lineStyle: { type: 'dashed' } } },
    series
  })
}

async function loadAlertCounts() {
  try {
    const alerts = await client.get('/alerts')
    const counts = { yellow: 0, orange: 0, red: 0 }
    for (const a of alerts) { if (counts[a.level] !== undefined && !a.is_acknowledged) counts[a.level]++ }
    alertCounts.value = counts
  } catch (e) { console.error('[Monitor] alert counts', e) }
}

async function injectAlert() {
  if (!selectedVehicle.value) return
  try { await client.post('/simulation/inject-alert', { vehicle_id: selectedVehicle.value }); ElMessage.success('已注入温度异常') } catch (e) { ElMessage.error('操作失败') }
}

onMounted(async () => {
  await loadSensors()
  await loadAlertCounts()
  await nextTick()
  initChart()
  const token = localStorage.getItem('token')
  socket = io('/', { path: '/socket.io', auth: { token } })
  socket.on('sensor:reading', (data) => {
    const sensor = allSensors.value.find(s => s.sensor_id === data.sensor_id || s.id === data.sensor_id)
    if (sensor) { sensor.latest_value = data.value; sensor.latest_time = data.recorded_at }
    if (!chartData.value[data.sensor_id]) chartData.value[data.sensor_id] = []
    chartData.value[data.sensor_id].push({ time: data.recorded_at?.substring(11,19) || '', value: data.value })
    if (chartData.value[data.sensor_id].length > 60) chartData.value[data.sensor_id].shift()
    if (chart) {
      const sid = chartData.value[data.sensor_id]
      if (sid && chart) initChart()
    }
  })
  socket.on('alert:new', () => loadAlertCounts())
  socket.on('alert:acknowledged', () => loadAlertCounts())
})

onUnmounted(() => { if (socket) socket.disconnect(); if (chart) chart.dispose() })
</script>

<style scoped>
.toolbar { display: flex; align-items: center; gap: var(--spacing-sm); background: var(--bg-card); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.sim-status { font-size: 12px; color: var(--color-green); margin-left: auto; }
.sensor-card { background: var(--bg-card); padding: var(--spacing-lg); border-radius: var(--radius-md); margin-bottom: var(--spacing-sm); box-shadow: var(--shadow-sm); border-left: 4px solid var(--color-success); }
.sensor-card.sensor-ok { border-left-color: var(--color-green); }
.sensor-card.sensor-yellow { border-left-color: var(--alert-yellow); background: var(--alert-yellow-bg); }
.sensor-card.sensor-orange { border-left-color: var(--alert-orange); background: var(--alert-orange-bg); }
.sensor-card.sensor-red { border-left-color: var(--alert-red); background: var(--alert-red-bg); }
.sensor-header { display: flex; justify-content: space-between; margin-bottom: var(--spacing-xs); }
.sensor-vehicle { font-weight: 500; color: var(--text-primary); }
.sensor-pos { font-size: 12px; color: var(--text-secondary); }
.sensor-temp { font-size: 36px; font-weight: bold; color: var(--text-primary); }
.sensor-meta { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.sensor-bar { height: 4px; background: var(--border-color-light); border-radius: 2px; margin-top: var(--spacing-sm); }
.sensor-bar-fill { height: 100%; border-radius: 2px; transition: width .5s; }

.chart-card { background: var(--bg-card); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); padding: 0; }
.chart-header { padding: var(--spacing-sm) var(--spacing-md); font-size: 14px; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color-light); }
.chart-box { height: 320px; width: 100%; }

.alert-summary-card { display: flex; align-items: center; gap: 14px; background: var(--bg-card); padding: 16px 20px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border-left: 4px solid; }
.alert-summary-yellow { border-left-color: var(--alert-yellow); }
.alert-summary-orange { border-left-color: var(--alert-orange); }
.alert-summary-red { border-left-color: var(--alert-red); }
.as-icon { font-size: 22px; }
.as-body { flex: 1; }
.as-count { font-size: 28px; font-weight: 700; line-height: 1; }
.alert-summary-yellow .as-count { color: var(--alert-yellow); }
.alert-summary-orange .as-count { color: var(--alert-orange); }
.alert-summary-red .as-count { color: var(--alert-red); }
.as-label { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-top: 2px; }
.as-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
</style>
