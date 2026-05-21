<template>
  <div class="dispatch-page">
    <div class="toolbar">
      <span class="toolbar-title">智能调度看板</span>
      <el-button type="primary" size="large" @click="runSuggest" :loading="analyzing" :disabled="selectedOrders.length === 0">
        智能分析 ({{ selectedOrders.length }})
      </el-button>
      <el-button type="success" @click="executeAll" :disabled="!plan || plan.plans.length === 0">
        一键全部派单
      </el-button>
      <el-button @click="loadData">刷新</el-button>
    </div>

    <div class="board">
      <!-- Left: Assignable Orders -->
      <div class="board-left">
        <el-card shadow="never" class="panel-card">
          <template #header><span class="panel-title">可派订单</span></template>
          <el-table :data="assignableOrders" v-loading="loading" @selection-change="onSelectionChange" stripe size="small" max-height="calc(100vh - 220px)" style="width:100%">
            <el-table-column type="selection" width="36" />
            <el-table-column prop="order_number" label="订单号" width="130" />
            <el-table-column prop="customer_name" label="客户" width="100" show-overflow-tooltip />
            <el-table-column label="目的地" width="50">
              <template #default="{row}">{{ row.delivery_city === 'shanghai' ? '上海' : '杭州' }}</template>
            </el-table-column>
            <el-table-column prop="product_summary" label="商品" show-overflow-tooltip />
            <el-table-column label="温控" width="60">
              <template #default="{row}">{{ row.required_temp_min }}~{{ row.required_temp_max }}°C</template>
            </el-table-column>
            <el-table-column prop="total_weight_kg" label="重量" width="55" />
            <el-table-column prop="status" label="状态" width="68">
              <template #default="{row}"><el-tag :type="statusTag(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <!-- Right: Results + Resources -->
      <div class="board-right">
        <!-- Plan Results -->
        <el-card shadow="never" class="panel-card plan-panel">
          <template #header><span class="panel-title">智能推荐方案</span></template>
          <div v-if="!plan" class="plan-empty">
            <div class="empty-stats">
              <div class="stat-item">
                <span class="stat-num">{{ assignableOrders.length }}</span>
                <span class="stat-label">待派订单</span>
              </div>
              <div class="stat-item">
                <span class="stat-num">{{ availableVehicles.filter(v => !v.is_busy).length }}/{{ availableVehicles.length }}</span>
                <span class="stat-label">可用车辆</span>
              </div>
              <div class="stat-item">
                <span class="stat-num">{{ availableDrivers.filter(d => !d.is_busy).length }}/{{ availableDrivers.length }}</span>
                <span class="stat-label">空闲司机</span>
              </div>
            </div>
            <p class="empty-hint">勾选左侧订单后点击「智能分析」，系统将自动匹配车辆与路线</p>
          </div>
          <el-empty v-else-if="plan.plans.length === 0" description="无可用方案" :image-size="60" />
          <div v-else class="plan-list">
            <div v-for="g in plan.plans" :key="g.groupIndex" class="plan-group-card">
              <div class="plan-header">
                <el-tag type="primary" size="small">方案 {{ g.groupIndex }}</el-tag>
                <span class="plan-reason">{{ g.reason }}</span>
                <el-tag :type="g.matchScore >= 80 ? 'success' : g.matchScore >= 50 ? 'warning' : 'danger'" size="small">
                  匹配度 {{ g.matchScore }}%
                </el-tag>
              </div>
              <div class="plan-detail">
                <div class="plan-orders">
                  <span class="detail-label">订单：</span>
                  <el-tag v-for="o in g.orders" :key="o.id" size="small" type="info" style="margin-right:4px;margin-bottom:2px">
                    {{ o.order_number }} | {{ o.customer_name }}
                  </el-tag>
                </div>
                <el-row :gutter="12" style="margin-top:8px">
                  <el-col :span="8"><span class="detail-label">车辆：</span>{{ g.suggestedVehicle ? g.suggestedVehicle.plate_number + ' (' + g.suggestedVehicle.vehicle_type + ')' : '无可用' }}</el-col>
                  <el-col :span="6"><span class="detail-label">司机：</span>{{ g.suggestedDriver ? g.suggestedDriver.display_name : '待分配' }}</el-col>
                  <el-col :span="4"><span class="detail-label">总重：</span>{{ g.totalWeight }}kg</el-col>
                  <el-col :span="6"><span class="detail-label">温区：</span>{{ g.tempRange.min }}~{{ g.tempRange.max }}°C</el-col>
                </el-row>
                <div class="stop-sequence" v-if="g.optimizedStops.length > 0">
                  <span class="detail-label">配送顺序：</span>
                  <span class="stop-item" v-for="(s, i) in g.optimizedStops" :key="s.order_id">
                    <span class="stop-num">{{ s.sequence }}</span>{{ s.customer_name }}
                    <span class="stop-dist" v-if="i > 0">{{ s.distance_from_prev_km }}km</span>
                  </span>
                </div>
                <el-button type="primary" size="small" @click="executePlan(g)" :disabled="!g.suggestedVehicle" style="margin-top:8px">
                  创建运输单
                </el-button>
              </div>
            </div>
          </div>
        </el-card>

        <!-- Available Resources -->
        <el-card shadow="never" class="panel-card">
          <template #header><span class="panel-title">可用资源</span></template>
          <el-row :gutter="12">
            <el-col :span="14">
              <p style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">车辆</p>
              <div v-for="v in availableVehicles" :key="v.id" class="resource-row">
                <span :class="['resource-dot', v.is_busy ? 'dot-busy' : 'dot-idle']"></span>
                <span>{{ v.plate_number }}</span>
                <el-tag size="small" :type="v.vehicle_type === 'refrigerated' ? '' : 'info'">{{ v.vehicle_type === 'refrigerated' ? '冷藏' : '保温' }}</el-tag>
                <span style="font-size:12px;color:var(--text-secondary)">{{ v.max_load_kg }}kg</span>
                <el-tag v-if="v.is_busy" size="small" type="warning">运输中</el-tag>
                <el-tag v-else size="small" type="success">空闲</el-tag>
              </div>
            </el-col>
            <el-col :span="10">
              <p style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">司机</p>
              <div v-for="d in availableDrivers" :key="d.id" class="resource-row">
                <span :class="['resource-dot', d.is_busy ? 'dot-busy' : 'dot-idle']"></span>
                <span>{{ d.display_name }}</span>
                <el-tag v-if="d.is_busy" size="small" type="warning">出车中</el-tag>
                <el-tag v-else size="small" type="success">待命</el-tag>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'
import client from '../../api/client'

const assignableOrders = ref([])
const availableVehicles = ref([])
const availableDrivers = ref([])
const selectedOrders = ref([])
const plan = ref(null)
const loading = ref(false)
const analyzing = ref(false)
let socket = null

const statusLabel = (s) => ({ pending:'待确认', confirmed:'已确认', processing:'处理中', in_transit:'运输中', delivered:'已送达', cancelled:'已取消' }[s] || s)
const statusTag = (s) => ({ pending:'warning', confirmed:'primary', processing:'', in_transit:'warning', delivered:'success', cancelled:'danger' }[s] || '')

async function loadData() {
  loading.value = true
  try {
    const data = await client.get('/dispatch/dashboard')
    assignableOrders.value = data.assignableOrders
    availableVehicles.value = data.availableVehicles
    availableDrivers.value = data.availableDrivers
  } catch (e) {
    ElMessage.error('加载调度数据失败')
  } finally {
    loading.value = false
  }
}

function onSelectionChange(rows) {
  selectedOrders.value = rows
  plan.value = null
}

async function runSuggest() {
  analyzing.value = true
  try {
    const ids = selectedOrders.value.map(o => o.id)
    plan.value = await client.post('/dispatch/suggest', { order_ids: ids })
    if (plan.value.plans.length === 0) ElMessage.warning(plan.value.message || '无可用调度方案')
  } catch (e) {
    ElMessage.error('分析失败')
  } finally {
    analyzing.value = false
  }
}

async function executePlan(group) {
  try {
    await client.post('/dispatch/execute', {
      plan: {
        groups: [{
          order_ids: group.orders.map(o => o.id),
          vehicle_id: group.suggestedVehicle.id,
          driver_id: group.suggestedDriver?.id || null,
          optimizedStops: group.optimizedStops
        }]
      }
    })
    ElMessage.success('运输单已创建')
    loadData()
    plan.value = null
    selectedOrders.value = []
  } catch (e) {
    ElMessage.error('派单失败')
  }
}

async function executeAll() {
  if (!plan.value || plan.value.plans.length === 0) return
  try {
    const groups = plan.value.plans.filter(g => g.suggestedVehicle).map(g => ({
      order_ids: g.orders.map(o => o.id),
      vehicle_id: g.suggestedVehicle.id,
      driver_id: g.suggestedDriver?.id || null,
      optimizedStops: g.optimizedStops
    }))
    if (groups.length === 0) { ElMessage.warning('没有可执行的方案'); return }
    await client.post('/dispatch/execute', { plan: { groups } })
    ElMessage.success(`已创建 ${groups.length} 个运输任务`)
    loadData()
    plan.value = null
    selectedOrders.value = []
  } catch (e) {
    ElMessage.error('批量派单失败')
  }
}

onMounted(() => {
  loadData()
  const token = localStorage.getItem('token')
  if (token) {
    socket = io('/', { path: '/socket.io', auth: { token } })
    socket.on('shipment:status-change', () => loadData())
  }
})

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.toolbar { display: flex; gap: var(--spacing-sm); align-items: center; background: var(--bg-card); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); margin-bottom: var(--spacing-sm); }
.toolbar-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-right: auto; }
.board { display: grid; grid-template-columns: 3fr 2fr; gap: var(--spacing-sm); height: calc(100vh - 160px); }
.board-left { overflow: hidden; }
.board-right { display: flex; flex-direction: column; gap: var(--spacing-sm); overflow: hidden; }
.panel-card { flex: 1; overflow-y: auto; }
.plan-panel { max-height: 55%; }
.panel-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.plan-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 30px 0; }
.empty-stats { display: flex; gap: 24px; }
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-num { font-size: 28px; font-weight: 700; color: var(--color-primary); line-height: 1; }
.stat-label { font-size: 12px; color: var(--text-secondary); }
.empty-hint { font-size: 13px; color: var(--text-secondary); text-align: center; max-width: 260px; line-height: 1.6; }
.plan-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.plan-group-card { border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-sm); background: var(--bg-card); }
.plan-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.plan-reason { font-size: 13px; color: var(--text-regular); flex: 1; }
.plan-detail { font-size: 13px; color: var(--text-regular); }
.plan-orders { margin-bottom: 4px; }
.detail-label { font-weight: 500; color: var(--text-secondary); }
.stop-sequence { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.stop-item { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--text-regular); }
.stop-num { background: var(--color-primary); color: #fff; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
.stop-dist { color: var(--text-secondary); font-size: 11px; }
.resource-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 13px; }
.resource-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-idle { background: var(--color-success); }
.dot-busy { background: var(--color-warning); }
</style>
