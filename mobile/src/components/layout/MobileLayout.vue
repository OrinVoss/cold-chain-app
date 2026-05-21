<template>
  <div class="mobile-layout">
    <div class="mobile-header">
      <span class="header-title">{{ pageTitle }}</span>
    </div>
    <div class="mobile-body">
      <router-view />
    </div>
    <van-tabbar v-model="active" route>
      <van-tabbar-item to="/home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/tasks" icon="orders-o">任务</van-tabbar-item>
      <van-tabbar-item to="/monitor" icon="chart-trending-o">监控</van-tabbar-item>
      <van-tabbar-item to="/alerts" icon="warning-o" :badge="alertBadge">告警</van-tabbar-item>
      <van-tabbar-item to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSocket } from '../../composables/useSocket'
import client from '../../api/client'

const route = useRoute()
const active = ref(0)
const alertCount = ref(0)
const { connect, on } = useSocket()

const pageTitle = computed(() => {
  const titles = {
    Home: '徽农优选冷链助手', Tasks: '运输任务', TaskDetail: '任务详情',
    Monitor: '温湿度监控', Alerts: '告警通知', Profile: '个人中心'
  }
  return titles[route.name] || '徽农优选'
})

const alertBadge = computed(() => alertCount.value > 0 ? alertCount.value : '')

onMounted(async () => {
  try {
    const stats = await client.get('/driver/alerts')
    alertCount.value = (stats || []).filter(a => !a.is_acknowledged).length
  } catch (e) { console.error('[Layout] alert load', e) }
  const token = localStorage.getItem('token')
  connect(token)
  on('alert:new', () => { alertCount.value++ })
  on('alert:acknowledged', () => { if (alertCount.value > 0) alertCount.value-- })
})
</script>

<style scoped>
.mobile-layout { height: 100vh; display: flex; flex-direction: column; }
.mobile-header { background: var(--color-primary); color: #fff; padding: 12px 16px; flex-shrink: 0; text-align: center; }
.header-title { font-size: 17px; font-weight: 500; }
.mobile-body { flex: 1; overflow-y: auto; background: var(--bg-page); -webkit-overflow-scrolling: touch; }
</style>
