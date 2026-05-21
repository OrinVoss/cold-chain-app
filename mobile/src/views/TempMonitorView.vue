<template>
  <div class="monitor-page">
    <div class="monitor-header">
      <span>{{ vehicleInfo?.plate_number || '车辆温湿度监控' }}</span>
      <span class="ws-indicator" :class="connected ? 'ws-on' : 'ws-off'">{{ connected ? '● 实时' : '○ 断开' }}</span>
    </div>

    <!-- Temperature gauges -->
    <div class="gauge-row">
      <div class="gauge-card" v-for="pos in ['front','middle','rear']" :key="pos" :class="gaugeClass(pos)">
        <div class="gauge-pos">{{ positionCN(pos) }}</div>
        <div class="gauge-value">{{ getTemp(pos) }}<span class="gauge-unit">°C</span></div>
        <div class="gauge-bar"><div class="gauge-fill" :style="{width: tempPercent(pos)+'%', background: tempColor(pos)}"></div></div>
      </div>
    </div>

    <!-- Humidity & door -->
    <div class="info-row">
      <div class="info-card">
        <div class="info-label">湿度</div>
        <div class="info-value" style="color:#409eff">{{ humidity }}<span class="info-unit">%</span></div>
      </div>
      <div class="info-card">
        <div class="info-label">车门状态</div>
        <div class="info-value" :style="{color: doorOpen ? '#f5222d' : '#52c41a'}">{{ doorOpen ? '已开启' : '已关闭' }}</div>
      </div>
    </div>

    <van-cell-group inset style="margin-top:12px">
      <van-cell title="温控要求" :value="`${reqTempMin}°C ~ ${reqTempMax}°C`" />
      <van-cell title="采集间隔" value="每3秒" />
      <van-cell title="数据状态">
        <template #value><span :class="connected ? 'ws-on' : 'ws-off'">{{ connected ? '实时更新中' : '已断开' }}</span></template>
      </van-cell>
    </van-cell-group>

    <div class="refresh-area">
      <van-button type="primary" size="small" plain @click="refreshData">刷新数据</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { showToast } from 'vant'
import client from '../api/client'

const temps = ref({ front: null, middle: null, rear: null })
const humidity = ref('--')
const doorOpen = ref(false)
const connected = ref(false)
const vehicleInfo = ref(null)
const reqTempMin = ref(0)
const reqTempMax = ref(4)
let socket = null

const positionCN = (p) => ({ front:'前部', middle:'中部', rear:'后部' }[p] || p)

function getTemp(pos) { const v = temps.value[pos]; return v != null ? v : '--' }
function tempPercent(pos) { const v = temps.value[pos]; return v != null ? Math.min(100, Math.max(0, (v/10)*100)) : 0 }
function tempColor(pos) {
  const v = temps.value[pos]; if (v == null) return '#909399'
  if (v > 6.5) return '#f5222d'; if (v > 5.5) return '#fa8c16'; if (v > 4.5) return '#e6a23c'; return '#52c41a'
}
function gaugeClass(pos) {
  const v = temps.value[pos]; if (v == null) return ''
  if (v > 6.5) return 'gauge-danger'; if (v > 5.5) return 'gauge-warning'; if (v > 4.5) return 'gauge-yellow'; return 'gauge-ok'
}

async function refreshData() {
  try {
    const tasks = await client.get('/driver/tasks')
    const activeTask = (tasks || []).find(t => t.status === 'in_transit')
    if (activeTask) {
      const detail = await client.get(`/driver/tasks/${activeTask.id}`)
      if (detail.temperatures) {
        for (const t of detail.temperatures) {
          if (t.latest_value != null) temps.value[t.sensor_position] = t.latest_value
        }
      }
      vehicleInfo.value = { plate_number: activeTask.plate_number, vehicle_id: activeTask.vehicle_id }
      const vehicleId = detail.vehicle_id || activeTask.vehicle_id
      const sensors = await client.get(`/sensors/vehicle/${vehicleId}`)
      for (const s of (sensors || [])) {
        if (s.sensor_type === 'humidity' && s.value != null) humidity.value = s.value
        if (s.sensor_type === 'door' && s.value != null) doorOpen.value = s.value === 1
      }
    }
  } catch (e) { console.error(e); showToast('加载失败'); }
}

onMounted(() => {
  refreshData()
  const token = localStorage.getItem('token')
  socket = io('/', { path: '/socket.io', auth: { token } })
  socket.on('connect', () => { connected.value = true })
  socket.on('disconnect', () => { connected.value = false })
  socket.on('sensor:reading', (data) => {
    if (data.sensor_type === 'temperature') temps.value[data.sensor_position] = data.value
    else if (data.sensor_type === 'humidity') humidity.value = data.value
    else if (data.sensor_type === 'door') doorOpen.value = data.value === 1
  })
})

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.monitor-page { padding: 12px; padding-bottom: 70px; }
.monitor-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.ws-on { color: #52c41a; }
.ws-off { color: #f5222d; }
.ws-indicator { font-size: 13px; }
.gauge-row { display: flex; gap: 10px; margin-top: 12px; }
.gauge-card { flex: 1; background: #fff; border-radius: 10px; padding: 16px 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.05); }
.gauge-card.gauge-ok { border-top: 3px solid #52c41a; }
.gauge-card.gauge-yellow { border-top: 3px solid #e6a23c; }
.gauge-card.gauge-warning { border-top: 3px solid #fa8c16; }
.gauge-card.gauge-danger { border-top: 3px solid #f5222d; }
.gauge-pos { font-size: 12px; color: #999; margin-bottom: 6px; }
.gauge-value { font-size: 28px; font-weight: bold; color: #303133; }
.gauge-unit { font-size: 14px; font-weight: normal; color: #999; }
.gauge-bar { height: 4px; background: #f0f0f0; border-radius: 2px; margin-top: 10px; }
.gauge-fill { height: 100%; border-radius: 2px; transition: width .5s; }

.info-row { display: flex; gap: 10px; margin-top: 12px; }
.info-card { flex: 1; background: #fff; border-radius: 10px; padding: 16px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.05); }
.info-label { font-size: 13px; color: #999; }
.info-value { font-size: 28px; font-weight: bold; margin-top: 6px; }
.info-unit { font-size: 14px; font-weight: normal; color: #999; }

.refresh-area { padding: 16px; text-align: center; }
</style>
