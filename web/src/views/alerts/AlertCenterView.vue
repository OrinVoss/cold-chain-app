<template>
  <div class="alerts-page">
    <div class="toolbar">
      <el-radio-group v-model="filterLevel" size="small">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="yellow">黄色</el-radio-button>
        <el-radio-button value="orange">橙色</el-radio-button>
        <el-radio-button value="red">红色</el-radio-button>
      </el-radio-group>
      <el-button @click="loadAlerts" style="margin-left:var(--spacing-sm)">刷新</el-button>
    </div>

    <div class="alert-list" style="margin-top:var(--spacing-md)">
      <div v-for="a in filteredAlerts" :key="a.id" class="alert-row" :class="'alert-row-' + a.level">
        <div class="alert-dot" :class="'dot-' + a.level"></div>
        <div class="alert-content">
          <div class="alert-header-row">
            <span class="alert-title">{{ a.title }}</span>
            <el-tag :type="levelTag(a.level)" size="small">{{ levelCN(a.level) }}</el-tag>
            <span v-if="a.is_acknowledged" class="ack-badge">已确认</span>
          </div>
          <div class="alert-msg">{{ a.message }} (偏差 {{ a.deviation }}°C)</div>
          <div class="alert-meta">{{ a.plate_number || '车辆'+a.vehicle_id }} · {{ a.created_at }}</div>
        </div>
        <div class="alert-action">
          <el-button v-if="!a.is_acknowledged" type="primary" size="small" @click="ackAlert(a.id)">确认</el-button>
        </div>
      </div>
      <el-empty v-if="filteredAlerts.length === 0 && !loading" description="暂无告警" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'
import client from '../../api/client'

const alerts = ref([])
const filterLevel = ref('')
const loading = ref(false)
let socket = null

const filteredAlerts = computed(() => {
  if (!filterLevel.value) return alerts.value
  return alerts.value.filter(a => a.level === filterLevel.value)
})

const levelCN = (l) => ({ yellow:'黄色预警', orange:'橙色预警', red:'红色预警' }[l] || l)
const levelTag = (l) => ({ yellow:'warning', orange:'danger', red:'danger' }[l] || '')

async function loadAlerts() {
  loading.value = true
  try { alerts.value = await client.get('/alerts') } catch (e) { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

async function ackAlert(id) {
  try {
    await client.put(`/alerts/${id}/acknowledge`)
    ElMessage.success('告警已确认')
    const a = alerts.value.find(a => a.id === id)
    if (a) a.is_acknowledged = 1
  } catch (e) { ElMessage.error('操作失败') }
}

onMounted(() => {
  loadAlerts()
  const token = localStorage.getItem('token')
  socket = io('/', { path: '/socket.io', auth: { token } })
  socket.on('alert:new', (data) => { alerts.value.unshift(data) })
  socket.on('alert:acknowledged', (data) => {
    const a = alerts.value.find(a => a.id === data.id)
    if (a) a.is_acknowledged = 1
  })
})

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.toolbar { display: flex; align-items: center; background: var(--bg-card); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.alert-row { display: flex; align-items: flex-start; padding: var(--spacing-md); background: var(--bg-card); margin-bottom: var(--spacing-xs); border-radius: var(--radius-md); border-left: 4px solid; box-shadow: var(--shadow-sm); gap: var(--spacing-sm); }
.alert-row-yellow { border-left-color: var(--alert-yellow); }
.alert-row-orange { border-left-color: var(--alert-orange); }
.alert-row-red { border-left-color: var(--alert-red); }
.alert-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.dot-yellow { background: var(--alert-yellow); }
.dot-orange { background: var(--alert-orange); }
.dot-red { background: var(--alert-red); }
.alert-content { flex: 1; }
.alert-header-row { display: flex; align-items: center; gap: var(--spacing-xs); }
.alert-title { font-weight: 500; color: var(--text-primary); }
.alert-msg { font-size: 13px; color: var(--text-regular); margin-top: 4px; }
.alert-meta { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.ack-badge { font-size: 12px; color: var(--color-success); }
.alert-action { flex-shrink: 0; }
</style>
