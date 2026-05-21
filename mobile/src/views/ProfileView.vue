<template>
  <div class="profile-page">
    <!-- Avatar section -->
    <div class="profile-header">
      <div class="avatar">{{ userInfo.display_name?.charAt(0) || '?' }}</div>
      <div class="name">{{ userInfo.display_name }}</div>
      <div class="role">{{ roleLabel(userInfo.role) }}</div>
    </div>

    <!-- Cold Chain Credit Score (from planning doc §4.3.1) -->
    <div class="credit-section" v-if="credit">
      <div class="credit-header">
        <span class="credit-title">冷链信用评分</span>
        <span :class="['credit-badge', 'badge-' + credit.level]">{{ levelLabel(credit.level) }}</span>
      </div>
      <div class="credit-body">
        <div class="credit-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#f0f0f0" stroke-width="8" />
            <circle cx="60" cy="60" r="52" fill="none" :stroke="ringColor" stroke-width="8"
              :stroke-dasharray="circumference" :stroke-dashoffset="circumference * (1 - credit.score / 100)"
              stroke-linecap="round" transform="rotate(-90, 60, 60)" style="transition: stroke-dashoffset 1s" />
          </svg>
          <div class="ring-text">
            <span class="ring-score">{{ credit.score }}</span>
            <span class="ring-unit">分</span>
          </div>
        </div>
        <div class="credit-metrics">
          <div class="metric-row">
            <span class="metric-label">温控达标率</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" :style="{ width: credit.tempCompliance + '%', background: barColor(credit.tempCompliance) }"></div>
            </div>
            <span class="metric-val">{{ credit.tempCompliance }}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">准时交付率</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" :style="{ width: credit.onTimeRate + '%', background: barColor(credit.onTimeRate) }"></div>
            </div>
            <span class="metric-val">{{ credit.onTimeRate }}%</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">异常响应速度</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" :style="{ width: credit.alertResponse + '%', background: barColor(credit.alertResponse) }"></div>
            </div>
            <span class="metric-val">{{ credit.alertResponse }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Info list -->
    <van-cell-group inset style="margin-top:12px">
      <van-cell title="用户名" :value="userInfo.username" />
      <van-cell title="手机号" :value="userInfo.phone || '未设置'" />
      <van-cell title="角色" :value="roleLabel(userInfo.role)" />
      <van-cell title="应用版本" value="v1.0.0 Demo" />
    </van-cell-group>

    <div class="logout-area">
      <van-button type="danger" block round @click="handleLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import client from '../api/client'

const router = useRouter()
const userInfo = ref({
  username: localStorage.getItem('display_name') || '',
  display_name: localStorage.getItem('display_name') || '司机',
  role: localStorage.getItem('role') || 'driver',
  phone: ''
})
const credit = ref(null)
const circumference = 2 * Math.PI * 52

const ringColor = '#1890ff'

const roleLabel = (r) => ({ admin:'管理员', warehouse:'仓管员', driver:'司机', viewer:'观察者' }[r] || r)
const levelLabel = (l) => ({ gold:'金牌司机', silver:'银牌司机', bronze:'铜牌司机' }[l] || l)

function barColor(v) {
  if (v >= 90) return '#67c23a'
  if (v >= 75) return '#1890ff'
  if (v >= 60) return '#e6a23c'
  return '#f5222d'
}

onMounted(async () => {
  try {
    const [user, score] = await Promise.all([
      client.get('/auth/me'),
      client.get('/driver/credit-score')
    ])
    userInfo.value = user
    credit.value = score
  } catch (e) { console.error('[Profile] load', e) }
})

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '提示', message: '确认退出登录？' })
    localStorage.clear()
    showToast('已退出登录')
    router.push('/login')
  } catch (e) { /* user cancelled */ }
}
</script>

<style scoped>
.profile-page { padding-bottom: 60px; }
.profile-header { background: linear-gradient(135deg, #1890ff, #36cfc9); padding: 32px 20px; text-align: center; color: #fff; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,.25); line-height: 64px; font-size: 28px; font-weight: 600; margin: 0 auto 12px; }
.name { font-size: 20px; font-weight: 600; }
.role { font-size: 13px; opacity: .8; margin-top: 4px; }

.credit-section { margin: 12px 16px; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.credit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.credit-title { font-size: 15px; font-weight: 600; color: #303133; }
.credit-badge { font-size: 11px; padding: 2px 10px; border-radius: 10px; font-weight: 500; }
.badge-gold { background: #fff7e6; color: #d48806; border: 1px solid #ffd591; }
.badge-silver { background: #f0f0f0; color: #595959; border: 1px solid #d9d9d9; }
.badge-bronze { background: #fdf0e6; color: #bf8032; border: 1px solid #efcba1; }

.credit-body { display: flex; align-items: center; gap: 16px; }
.credit-ring { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
.ring-svg { width: 100px; height: 100px; }
.ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-score { font-size: 26px; font-weight: 700; color: #303133; line-height: 1; }
.ring-unit { font-size: 11px; color: #909399; margin-top: 2px; }

.credit-metrics { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.metric-row { display: flex; align-items: center; gap: 8px; }
.metric-label { font-size: 12px; color: #606266; width: 70px; flex-shrink: 0; }
.metric-bar-wrap { flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.metric-bar { height: 100%; border-radius: 3px; transition: width 1s; }
.metric-val { font-size: 12px; font-weight: 600; color: #303133; width: 36px; text-align: right; }

.logout-area { padding: 24px 16px; }
</style>
