<template>
  <div class="order-detail-page">
    <div class="toolbar">
      <el-button @click="$router.push('/orders')" link><el-icon><ArrowLeft /></el-icon> 返回订单列表</el-button>
    </div>

    <el-row :gutter="12" v-loading="loading">
      <!-- Left: Order Info + Items -->
      <el-col :span="14">
        <el-card shadow="never" class="detail-card">
          <template #header>
            <span class="card-title">订单信息 — {{ order.order_number }}</span>
            <el-tag :type="statusType(order.status)" style="margin-left:12px">{{ statusLabel(order.status) }}</el-tag>
          </template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="订单号">{{ order.order_number }}</el-descriptions-item>
            <el-descriptions-item label="状态"><el-tag :type="statusType(order.status)" size="small">{{ statusLabel(order.status) }}</el-tag></el-descriptions-item>
            <el-descriptions-item label="客户">{{ order.customer_name }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ order.customer_phone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目的地">{{ order.delivery_city === 'shanghai' ? '上海' : order.delivery_city === 'hangzhou' ? '杭州' : order.delivery_city }}</el-descriptions-item>
            <el-descriptions-item label="温控">{{ order.required_temp_min }}°C ~ {{ order.required_temp_max }}°C</el-descriptions-item>
            <el-descriptions-item label="地址" :span="2">{{ order.delivery_address }}</el-descriptions-item>
            <el-descriptions-item label="重量">{{ order.total_weight_kg }}kg</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ order.created_at }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ order.notes || '-' }}</el-descriptions-item>
          </el-descriptions>

          <el-divider />
          <p style="font-weight:600;margin-bottom:8px">商品清单</p>
          <el-table :data="order.items" size="small">
            <el-table-column prop="product_name" label="商品" width="140" />
            <el-table-column prop="sku_code" label="SKU" width="110" />
            <el-table-column prop="category" label="品类" width="70">
              <template #default="{row}">{{ categoryLabel(row.category) }}</template>
            </el-table-column>
            <el-table-column prop="quantity_kg" label="数量(kg)" width="90" />
          </el-table>
        </el-card>
      </el-col>

      <!-- Right: Shipment Link + Timeline + Temps -->
      <el-col :span="10">
        <!-- Linked Shipment -->
        <el-card shadow="never" class="detail-card" v-if="linkedShipment">
          <template #header><span class="card-title">关联运输</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="运输编号">{{ linkedShipment.shipment_code }}</el-descriptions-item>
            <el-descriptions-item label="车辆">{{ linkedShipment.plate_number || '未分配' }}</el-descriptions-item>
            <el-descriptions-item label="司机">{{ linkedShipment.driver_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="运输状态">
              <el-tag :type="shipStatusTag(linkedShipment.shipment_status)" size="small">{{ shipStatusLabel(linkedShipment.shipment_status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="站点顺序">第 {{ linkedShipment.stop_sequence }} 站</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="detail-card" v-else>
          <template #header><span class="card-title">关联运输</span></template>
          <el-empty description="暂无关联运输任务" :image-size="50" />
        </el-card>

        <!-- Status Timeline -->
        <el-card shadow="never" class="detail-card" style="margin-top:var(--spacing-sm)">
          <template #header><span class="card-title">状态流转</span></template>
          <el-timeline>
            <el-timeline-item
              v-for="t in timeline"
              :key="t.status"
              :color="t.active ? 'var(--color-primary)' : 'var(--border-color)'"
              :timestamp="t.time || ''"
            >
              {{ t.label }}
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <!-- Latest Temperatures (aligned with backend §4.2.1 thresholds) -->
        <el-card shadow="never" class="detail-card" style="margin-top:var(--spacing-sm)" v-if="latestTemps && latestTemps.length">
          <template #header><span class="card-title">最新温度</span></template>
          <div class="temp-row" v-for="t in latestTemps" :key="t.sensor_position">
            <span class="temp-pos">{{ t.sensor_position === 'front' ? '前部' : t.sensor_position === 'middle' ? '中部' : '后部' }}</span>
            <span class="temp-value" :class="{ 'temp-danger': t.value > 4.5 }">{{ t.value }}°C</span>
            <span class="temp-time">{{ t.recorded_at?.substring(11, 19) }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import client from '../../api/client'

const route = useRoute()
const order = ref({ items: [] })
const linkedShipment = ref(null)
const timeline = ref([])
const latestTemps = ref(null)
const loading = ref(false)

const statusLabel = (s) => ({ pending:'待确认', confirmed:'已确认', processing:'处理中', in_transit:'运输中', delivered:'已送达', cancelled:'已取消' }[s] || s)
const statusType = (s) => ({ pending:'warning', confirmed:'primary', processing:'', in_transit:'warning', delivered:'success', cancelled:'danger' }[s] || '')
const shipStatusLabel = (s) => ({ planned:'待规划', assigned:'已分配', loaded:'已装车', in_transit:'运输中', arrived:'已到达', completed:'已完成', exception:'异常' }[s] || s)
const shipStatusTag = (s) => ({ planned:'info', assigned:'', loaded:'', in_transit:'warning', arrived:'', completed:'success', exception:'danger' }[s] || '')
const categoryLabel = (c) => ({ tea:'茶叶', vegetable:'蔬菜', fruit:'水果', meat:'肉类', other:'其他' }[c] || c)

async function loadJourney() {
  loading.value = true
  try {
    const data = await client.get(`/orders/${route.params.id}/journey`)
    order.value = data.order
    linkedShipment.value = data.linkedShipment
    timeline.value = data.timeline
    latestTemps.value = data.latestTemps
  } catch (e) {
    ElMessage.error('加载订单详情失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadJourney)
</script>

<style scoped>
.toolbar { margin-bottom: var(--spacing-sm); }
.detail-card { border-radius: var(--radius-md); margin-bottom: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.temp-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border-color-light); }
.temp-row:last-child { border-bottom: none; }
.temp-pos { font-size: 13px; color: var(--text-secondary); width: 40px; }
.temp-value { font-size: 18px; font-weight: 600; color: var(--color-success); }
.temp-value.temp-danger { color: var(--color-danger); }
.temp-time { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
</style>
