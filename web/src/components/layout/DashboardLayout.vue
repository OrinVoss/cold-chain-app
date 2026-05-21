<template>
  <el-container class="layout">
    <el-aside width="200px" class="sidebar">
      <div class="logo" @click="$router.push('/dashboard')">
        <span class="logo-icon">❄</span>
        <span>徽农优选冷链</span>
      </div>
      <div class="nav-list">
        <router-link to="/dashboard" class="nav-item" :class="{active: $route.path==='/dashboard'}">
          <span class="nav-dot"></span>概览仪表盘
        </router-link>
        <router-link to="/monitoring" class="nav-item" :class="{active: $route.path==='/monitoring'}">
          <span class="nav-dot"></span>温度监控
        </router-link>
        <router-link to="/orders" class="nav-item" :class="{active: $route.path.startsWith('/orders')}">
          <span class="nav-dot"></span>订单管理
        </router-link>
        <router-link to="/shipments" class="nav-item" :class="{active: $route.path==='/shipments'}">
          <span class="nav-dot"></span>运输追踪
        </router-link>
        <router-link to="/alerts" class="nav-item" :class="{active: $route.path==='/alerts'}">
          <span class="nav-dot"></span>告警中心
        </router-link>
        <router-link to="/dispatch" class="nav-item" :class="{active: $route.path==='/dispatch'}">
          <span class="nav-dot"></span>智能调度
        </router-link>
        <router-link to="/warehouse" class="nav-item" :class="{active: $route.path==='/warehouse'}">
          <span class="nav-dot"></span>仓储管理
        </router-link>
      </div>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <span class="page-title">{{ $route.meta.title }}</span>
        <div class="topbar-right">
          <span class="ws-status" :class="wsConnected ? 'ws-on' : 'ws-off'">
            {{ wsConnected ? '● 实时连接' : '○ 已断开' }}
          </span>
          <el-dropdown trigger="click">
            <span class="user-info">{{ userName }} <el-icon><ArrowDown /></el-icon></span>
            <template #dropdown>
              <el-dropdown-menu><el-dropdown-item @click="logout">退出登录</el-dropdown-item></el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../../composables/useSocket'

const route = useRoute()
const router = useRouter()
const userName = ref(localStorage.getItem('display_name') || '管理员')
const { connected: wsConnected, connect, disconnect } = useSocket()

onMounted(() => {
  const token = localStorage.getItem('token')
  if (token) connect(token)
})

function logout() {
  localStorage.clear()
  disconnect()
  router.push('/login')
}

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.layout { height: 100vh; }
.sidebar { background: linear-gradient(180deg, #001529 0%, #002140 100%); display: flex; flex-direction: column; }
.logo { padding: 22px 20px; color: #fff; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.08); }
.logo-icon { font-size: 22px; }
.nav-list { flex: 1; padding: 12px 0; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 24px; color: var(--sidebar-text); text-decoration: none; font-size: 14px; transition: all .2s; border-left: 3px solid transparent; }
.nav-item:hover { color: var(--sidebar-text-active); background: rgba(255,255,255,.06); }
.nav-item.active { color: var(--sidebar-text-active); background: rgba(24,144,255,.15); border-left-color: var(--color-primary); }
.nav-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.3); transition: all .2s; }
.nav-item.active .nav-dot { background: var(--color-primary); box-shadow: 0 0 6px rgba(24,144,255,.6); }
.topbar { background: var(--bg-card); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; z-index: 10; }
.page-title { font-size: 16px; font-weight: 500; color: var(--text-primary); }
.topbar-right { display: flex; align-items: center; gap: 20px; }
.ws-status { font-size: 12px; }
.ws-on { color: var(--color-success); }
.ws-off { color: var(--color-danger); }
.user-info { cursor: pointer; color: var(--text-regular); font-size: 14px; }
.main-content { background: var(--bg-page); padding: 16px; min-height: 0; }
</style>
