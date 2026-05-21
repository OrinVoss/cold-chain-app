<template>
  <div class="task-detail-page">
    <van-nav-bar title="任务详情" left-text="返回" left-arrow @click-left="$router.back()" />

    <div v-if="task">
      <!-- Header info -->
      <div class="task-header">
        <div class="task-code">{{ task.shipment_code }}</div>
        <van-tag :type="statusColor(task.status)" size="medium">{{ statusCN(task.status) }}</van-tag>
      </div>
      <van-cell-group inset>
        <van-cell title="车辆" :value="task.plate_number || '未分配'" />
        <van-cell title="车型" :value="task.vehicle_type || '-'" />
        <van-cell title="总重" :value="task.total_weight_kg + ' kg'" />
      </van-cell-group>

      <!-- Temperature summary -->
      <div class="section-title">车辆温度</div>
      <div class="temp-row">
        <div class="temp-item" v-for="t in (task.temperatures || [])" :key="t.sensor_position">
          <div class="temp-pos">{{ positionCN(t.sensor_position) }}</div>
          <div class="temp-val" :class="tempClass(t.latest_value)">{{ t.latest_value != null ? t.latest_value + '°C' : '--' }}</div>
        </div>
      </div>

      <!-- Stops timeline -->
      <div class="section-title">配送站点</div>
      <van-steps direction="vertical" :active="currentStopIndex">
        <van-step v-for="stop in (task.stops || [])" :key="stop.id">
          <div class="stop-card">
            <div class="stop-customer">{{ stop.stop_sequence }}. {{ stop.customer_name }}</div>
            <div class="stop-addr">{{ stop.delivery_address }}</div>
            <div class="stop-meta">{{ stop.total_weight_kg }}kg · {{ stop.required_temp_min }}-{{ stop.required_temp_max }}°C</div>
            <van-tag size="small">{{ stopStatus(stop.status) }}</van-tag>
          </div>
        </van-step>
      </van-steps>

      <!-- Action buttons -->
      <div class="actions">
        <van-button v-if="task.status==='assigned'" type="primary" block round @click="startTransport">开始运输</van-button>
        <van-button v-if="task.status==='in_transit'" type="success" block round @click="arriveNextStop">到达下一站</van-button>
        <van-button v-if="task.status==='in_transit' && hasPendingStop" type="warning" block round style="margin-top:10px" @click="confirmDelivery">确认送达当前站</van-button>
      </div>
    </div>

    <van-loading v-else class="loading-center" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import client from '../api/client'

const route = useRoute()
const router = useRouter()
const task = ref(null)

const statusCN = (s) => ({ assigned:'待出发', loaded:'已装车', in_transit:'运输中', arrived:'已到达', completed:'已完成' }[s] || s)
const statusColor = (s) => ({ assigned:'primary', loaded:'primary', in_transit:'warning', arrived:'success', completed:'success' }[s] || '')
const stopStatus = (s) => ({ pending:'待配送', arrived:'已到达', delivered:'已送达' }[s] || s)
const positionCN = (p) => ({ front:'前部', middle:'中部', rear:'后部' }[p] || p)
const tempClass = (v) => {
  if (v == null) return ''
  if (v > 6.5) return 'temp-red'
  if (v > 5.5) return 'temp-orange'
  if (v > 4.5) return 'temp-yellow'
  return 'temp-ok'
}

const currentStopIndex = computed(() => {
  if (!task.value?.stops) return 0
  const delivered = task.value.stops.filter(s => s.status === 'delivered').length
  return delivered
})

const hasPendingStop = computed(() => {
  return task.value?.stops?.some(s => s.status === 'arrived' || s.status === 'pending')
})

async function loadTask() {
  try {
    task.value = await client.get(`/driver/tasks/${route.params.id}`)
  } catch (e) {
    showToast('加载任务失败')
    router.back()
  }
}

async function startTransport() {
  try {
    await client.put(`/driver/tasks/${route.params.id}/start`)
    showSuccessToast('运输已开始')
    loadTask()
  } catch (e) { showToast('操作失败') }
}

async function arriveNextStop() {
  try {
    const nextStop = task.value.stops?.find(s => s.status === 'pending')
    if (!nextStop) { showToast('所有站点已完成'); return }
    await client.put(`/shipments/${route.params.id}/stops/${nextStop.id}`, { status: 'arrived' })
    showSuccessToast(`已到达: ${nextStop.customer_name}`)
    loadTask()
  } catch (e) { showToast('操作失败') }
}

async function confirmDelivery() {
  try {
    const currentStop = task.value.stops?.find(s => s.status === 'arrived')
    if (!currentStop) { showToast('请先点击"到达下一站"'); return }
    await client.put(`/shipments/${route.params.id}/stops/${currentStop.id}`, { status: 'delivered' })
    showSuccessToast(`已送达: ${currentStop.customer_name}`)
    loadTask()
  } catch (e) { showToast('操作失败') }
}
onMounted(loadTask)
</script>

<style scoped>
.task-detail-page { padding-bottom: 100px; }
.task-header { padding: 16px; display: flex; align-items: center; gap: 12px; background: #fff; }
.task-code { font-size: 18px; font-weight: 600; color: #303133; }
.section-title { padding: 16px 16px 8px; font-size: 15px; font-weight: 500; color: #303133; }
.temp-row { display: flex; gap: 12px; padding: 0 16px; }
.temp-item { flex: 1; text-align: center; background: #fff; border-radius: 8px; padding: 12px 8px; }
.temp-pos { font-size: 12px; color: #909399; }
.temp-val { font-size: 22px; font-weight: bold; margin-top: 4px; }
.temp-val.temp-ok { color: #67c23a; }
.temp-val.temp-warn { color: #e6a23c; }
.temp-val.temp-red { color: #f5222d; }
.stop-card { padding: 8px 0; }
.stop-customer { font-weight: 500; color: #303133; }
.stop-addr { font-size: 13px; color: #606266; margin-top: 2px; }
.stop-meta { font-size: 12px; color: #909399; margin-top: 2px; }
.actions { padding: 20px 16px; }
.loading-center { display: flex; justify-content: center; padding-top: 100px; }
</style>
