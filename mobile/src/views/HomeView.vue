<template>
  <div class="home-page">
    <!-- Header card -->
    <div class="header-card">
      <div class="header-avatar">{{ driverName.charAt(0) }}</div>
      <div class="header-info">
        <div class="header-name">{{ driverName }}</div>
        <div class="header-role">冷链配送司机</div>
      </div>
      <div class="header-date">{{ today }}</div>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-item" @click="$router.push('/tasks')">
        <div class="stat-num">{{ stats.totalTasks }}</div>
        <div class="stat-label">今日任务</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-num" style="color:#52c41a">{{ stats.completedTasks }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item" @click="$router.push('/alerts')">
        <div class="stat-num" style="color:#f5222d">{{ stats.activeAlerts }}</div>
        <div class="stat-label">待处理告警</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-num" style="color:#722ed1">{{ stats.completedPercent }}%</div>
        <div class="stat-label">完成率</div>
      </div>
    </div>

    <!-- Current task -->
    <div class="section-card" v-if="currentTask" @click="$router.push('/tasks/' + currentTask.id)">
      <div class="section-title">
        <span>当前任务</span>
        <van-tag type="warning" size="small">{{ statusLabel(currentTask.status) }}</van-tag>
      </div>
      <div class="task-row">
        <span class="task-code">{{ currentTask.shipment_code }}</span>
        <span class="task-progress">{{ currentTask.delivered_stops }}/{{ currentTask.total_stops }} 站</span>
      </div>
      <div class="task-meta">{{ currentTask.plate_number }}</div>
    </div>

    <!-- Quick actions -->
    <div class="action-grid">
      <div class="action-item" @click="$router.push('/tasks')">
        <van-icon name="orders-o" size="24" color="#1890ff" />
        <span>运输任务</span>
      </div>
      <div class="action-item" @click="$router.push('/monitor')">
        <van-icon name="chart-trending-o" size="24" color="#52c41a" />
        <span>温控监测</span>
      </div>
      <div class="action-item" @click="$router.push('/alerts')">
        <van-icon name="warning-o" size="24" color="#fa8c16" />
        <span>告警通知</span>
      </div>
      <div class="action-item" @click="$router.push('/profile')">
        <van-icon name="user-o" size="24" color="#722ed1" />
        <span>个人中心</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { showToast } from 'vant'
import client from '../api/client'

const driverName = ref(localStorage.getItem('display_name') || '司机')
const today = ref(new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' }))
const stats = reactive({ totalTasks: 0, completedTasks: 0, activeAlerts: 0, completedPercent: 0 })
const currentTask = ref(null)

const statusLabel = (s) => ({ assigned:'待出发', loaded:'已装车', in_transit:'运输中' }[s] || s)

onMounted(async () => {
  try {
    const tasks = await client.get('/driver/tasks')
    stats.totalTasks = tasks.length
    const completedStops = tasks.reduce((sum, t) => sum + (t.delivered_stops || 0), 0)
    const totalStops = tasks.reduce((sum, t) => sum + (t.total_stops || 0), 0)
    stats.completedPercent = totalStops > 0 ? Math.round(completedStops / totalStops * 100) : 0
    currentTask.value = tasks.find(t => t.status === 'in_transit') || null
  } catch (e) { console.error(e); showToast('加载失败'); }
  try {
    const alerts = await client.get('/driver/alerts')
    stats.activeAlerts = (alerts || []).filter(a => !a.is_acknowledged).length
  } catch (e) { console.error(e); showToast('加载失败'); }
})
</script>

<style scoped>
.home-page { padding: 12px 12px 70px; }
.header-card { background: linear-gradient(135deg, #1890ff, #36cfc9); border-radius: 12px; padding: 20px; color: #fff; display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.header-avatar { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.25); text-align: center; line-height: 44px; font-size: 20px; font-weight: 600; }
.header-info { flex: 1; }
.header-name { font-size: 18px; font-weight: 600; }
.header-role { font-size: 12px; opacity: .8; margin-top: 2px; }
.header-date { font-size: 12px; opacity: .8; }

.stats-row { background: #fff; border-radius: 10px; display: flex; padding: 16px 8px; margin-bottom: 12px; }
.stat-item { flex: 1; text-align: center; cursor: pointer; }
.stat-divider { width: 1px; background: #f0f0f0; margin: 4px 0; }
.stat-num { font-size: 22px; font-weight: 700; color: #303133; }
.stat-label { font-size: 11px; color: #999; margin-top: 4px; }

.section-card { background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 12px; cursor: pointer; }
.section-title { display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 10px; }
.task-row { display: flex; justify-content: space-between; align-items: center; }
.task-code { font-size: 14px; color: #303133; font-weight: 500; }
.task-progress { font-size: 14px; color: #fa8c16; }
.task-meta { font-size: 12px; color: #999; margin-top: 6px; }

.action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: #fff; border-radius: 10px; padding: 8px 0; }
.action-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; cursor: pointer; font-size: 12px; color: #606266; }
</style>
