<template>
  <div class="alert-list-page">
    <van-tabs v-model:active="activeTab" sticky>
      <van-tab :title="'未处理(' + unacknowledged.length + ')'" />
      <van-tab title="已确认" />
    </van-tabs>

    <div class="alert-items" v-if="displayAlerts.length > 0">
      <div v-for="a in displayAlerts" :key="a.id" class="alert-card" :class="'border-' + a.level">
        <div class="alert-card-header">
          <van-tag :type="levelTagType(a.level)" size="small">{{ levelCN(a.level) }}</van-tag>
          <span class="alert-time">{{ timeAgo(a.created_at) }}</span>
        </div>
        <div class="alert-card-title">{{ a.title }}</div>
        <div class="alert-card-msg">{{ a.message }}</div>
        <div class="alert-card-footer">
          <span>{{ a.plate_number || '车辆'+a.vehicle_id }}</span>
          <span v-if="a.is_acknowledged" style="color:#67c23a">✓ 已确认</span>
          <van-button v-else size="small" type="primary" @click.stop="ackAlert(a)">确认</van-button>
        </div>
      </div>
    </div>

    <van-empty v-else description="暂无告警" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showToast, showSuccessToast } from 'vant'
import { io } from 'socket.io-client'
import client from '../api/client'

const alerts = ref([])
const activeTab = ref(0)

const unacknowledged = computed(() => alerts.value.filter(a => !a.is_acknowledged))
const acknowledged = computed(() => alerts.value.filter(a => a.is_acknowledged))
const displayAlerts = computed(() => activeTab.value === 0 ? unacknowledged.value : acknowledged.value)

const levelCN = (l) => ({ yellow:'黄色', orange:'橙色', red:'红色' }[l] || l)
const levelTagType = (l) => ({ yellow:'warning', orange:'warning', red:'danger' }[l] || '')

const timeAgo = (t) => {
  if (!t) return ''
  const diff = Math.floor((Date.now() - new Date(t.replace(' ','T')).getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff/60) + '分钟前'
  return Math.floor(diff/3600) + '小时前'
}

async function loadAlerts() {
  try {
    alerts.value = await client.get('/driver/alerts')
  } catch (e) { console.error('[Alerts] load failed', e) }
}

let socket = null

async function ackAlert(alert) {
  if (alert.is_acknowledged) return
  try {
    await client.put(`/driver/alerts/${alert.id}/acknowledge`)
    alert.is_acknowledged = 1
    showSuccessToast('告警已确认')
  } catch (e) { showToast('操作失败') }
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
.alert-list-page { padding-bottom: 60px; }
.alert-items { padding: 12px; }
.alert-card { background: #fff; border-radius: 8px; padding: 14px; margin-bottom: 10px; border-left: 4px solid; }
.alert-card.border-yellow { border-left-color: #e6a23c; }
.alert-card.border-orange { border-left-color: #fa8c16; }
.alert-card.border-red { border-left-color: #f5222d; }
.alert-card-header { display: flex; justify-content: space-between; align-items: center; }
.alert-time { font-size: 12px; color: #909399; }
.alert-card-title { font-weight: 500; color: #303133; margin-top: 6px; }
.alert-card-msg { font-size: 13px; color: #606266; margin-top: 4px; }
.alert-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 12px; color: #909399; }
</style>
