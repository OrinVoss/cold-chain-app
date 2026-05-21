<template>
  <div class="shipments-page">
    <!-- Status Pipeline -->
    <div class="pipe-row">
      <div v-for="col in statusCols" :key="col.status" class="pipe-card" :class="{ active: filterStatus === col.status }" @click="filterStatus = filterStatus === col.status ? '' : col.status">
        <div class="pipe-label" :style="{color: col.color}">{{ col.label }}</div>
        <div class="pipe-count">{{ countByStatus(col.status) }}</div>
      </div>
    </div>

    <!-- Shipment list -->
    <el-card v-for="ship in filteredShipments" :key="ship.id" shadow="never" class="ship-card" @click="viewShipment(ship)">
      <el-row align="middle">
        <el-col :span="3"><div class="ship-code">{{ ship.shipment_code }}</div></el-col>
        <el-col :span="3"><el-tag :type="statusTag(ship.status)">{{ statusCN(ship.status) }}</el-tag></el-col>
        <el-col :span="3"><span>{{ ship.plate_number || '未分配' }}</span></el-col>
        <el-col :span="2"><span>{{ ship.driver_name || '-' }}</span></el-col>
        <el-col :span="4"><span class="stops-text">{{ ship.stops_summary || '-' }}</span></el-col>
        <el-col :span="3"><span>总重: {{ ship.total_weight_kg }}kg</span></el-col>
        <el-col :span="3"><span>{{ ship.stop_count || 0 }} 站</span></el-col>
        <el-col :span="3">
          <el-button type="primary" size="small" v-if="ship.status==='assigned'" @click.stop="startShipment(ship.id)">开始运输</el-button>
          <el-button type="success" size="small" v-if="ship.status==='in_transit'" @click.stop="completeStop(ship)">确认送达</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-empty v-if="filteredShipments.length === 0" description="暂无运输任务" />

    <!-- Detail dialog -->
    <el-dialog v-model="showDetail" title="运输详情" width="700px">
      <div v-if="currentShipment">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="运输编号">{{ currentShipment.shipment_code }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusCN(currentShipment.status) }}</el-descriptions-item>
          <el-descriptions-item label="车辆">{{ currentShipment.plate_number || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="司机">{{ currentShipment.driver_name || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-divider />
        <p><b>配送站点：</b></p>
        <el-timeline>
          <el-timeline-item v-for="stop in currentShipment.stops" :key="stop.id"
            :timestamp="stop.estimated_arrival"
            :color="stop.status === 'delivered' ? 'var(--color-success)' : stop.status === 'arrived' ? 'var(--color-primary)' : 'var(--color-info)'">
            <p><b>{{ stop.customer_name }}</b></p>
            <p style="font-size:12px;color:var(--text-secondary)">{{ stop.delivery_address }}</p>
            <el-tag size="small">{{ stopStatus(stop.status) }}</el-tag>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import client from '../../api/client'

const shipments = ref([])
const filterStatus = ref('')
const showDetail = ref(false)
const currentShipment = ref(null)

const statusCols = [
  { status: 'planned', label: '待规划', color: 'var(--color-info)' },
  { status: 'assigned', label: '已分配', color: 'var(--color-primary)' },
  { status: 'loaded', label: '已装车', color: 'var(--color-purple)' },
  { status: 'in_transit', label: '运输中', color: 'var(--color-warning)' },
  { status: 'arrived', label: '已到达', color: 'var(--color-success)' },
  { status: 'completed', label: '已完成', color: 'var(--color-cyan)' }
]

const statusCN = (s) => ({ planned:'待规划', assigned:'已分配', loaded:'已装车', in_transit:'运输中', arrived:'已到达', completed:'已完成', exception:'异常' }[s] || s)
const statusTag = (s) => ({ planned:'info', assigned:'primary', loaded:'', in_transit:'warning', arrived:'success', completed:'success', exception:'danger' }[s] || '')
const stopStatus = (s) => ({ pending:'待配送', arrived:'已到达', delivered:'已送达' }[s] || s)

const filteredShipments = computed(() => filterStatus.value ? shipments.value.filter(s => s.status === filterStatus.value) : shipments.value)
const countByStatus = (status) => shipments.value.filter(s => s.status === status).length

async function loadShipments() { try { shipments.value = await client.get('/shipments') } catch (e) { ElMessage.error('加载失败') } }
async function startShipment(id) { try { await client.put(`/shipments/${id}/status`, { status: 'in_transit' }); ElMessage.success('运输已开始'); loadShipments() } catch (e) { ElMessage.error('操作失败') } }
async function completeStop(ship) {
  try {
    const arrivedStop = ship.stops?.find(s => s.status === 'arrived')
    if (arrivedStop) { await client.put(`/shipments/${ship.id}/stops/${arrivedStop.id}`, { status: 'delivered' }); ElMessage.success(`已确认送达: ${arrivedStop.customer_name}`) }
    else { await client.put(`/shipments/${ship.id}/status`, { status: 'completed' }); ElMessage.success('运输已完成') }
    loadShipments()
  } catch (e) { ElMessage.error('操作失败') }
}
function viewShipment(ship) { currentShipment.value = ship; showDetail.value = true }

onMounted(loadShipments)
</script>

<style scoped>
.pipe-row { display: flex; gap: var(--spacing-sm); background: var(--bg-card); padding: var(--spacing-sm); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.pipe-card { flex: 1; text-align: center; cursor: pointer; padding: var(--spacing-sm) var(--spacing-xs); border-radius: var(--radius-md); transition: all .2s; }
.pipe-card:hover { background: var(--bg-hover); }
.pipe-card.active { background: var(--color-primary-light); box-shadow: 0 0 0 2px var(--color-primary); }
.pipe-label { font-size: 13px; font-weight: 500; }
.pipe-count { font-size: 24px; font-weight: bold; color: var(--text-primary); margin-top: 4px; }
.ship-card { margin-bottom: var(--spacing-sm); cursor: pointer; border-radius: var(--radius-md); transition: box-shadow .2s; }
.ship-card:hover { box-shadow: var(--shadow-md) !important; }
.ship-code { font-weight: 500; color: var(--text-primary); font-size: 14px; }
.stops-text { font-size: 12px; color: var(--text-regular); }
</style>
