<template>
  <div class="warehouse-page">
    <!-- KPI Row -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-value">{{ dashboard.totalStockKg || 0 }}<span class="kpi-unit"> kg</span></div>
        <div class="kpi-label">总库存量</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ dashboard.totalProducts || 0 }}<span class="kpi-unit"> 种</span></div>
        <div class="kpi-label">在库品类</div>
      </div>
      <div class="kpi-card" :class="{ 'kpi-warn': dashboard.expiryAlerts > 0 }">
        <div class="kpi-value">{{ dashboard.expiryAlerts || 0 }}<span class="kpi-unit"> 项</span></div>
        <div class="kpi-label">临期预警</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ dashboard.todayInKg || 0 }}<span class="kpi-unit"> kg</span></div>
        <div class="kpi-label">今日入库</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ dashboard.todayOutKg || 0 }}<span class="kpi-unit"> kg</span></div>
        <div class="kpi-label">今日出库</div>
      </div>
    </div>

    <el-card shadow="never" style="margin-top:var(--spacing-sm)">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="库存概览" name="inventory">
          <el-table :data="inventory" stripe size="small">
            <el-table-column prop="sku_code" label="SKU" width="120" />
            <el-table-column prop="name" label="品名" width="130" />
            <el-table-column label="品类" width="80">
              <template #default="{row}">{{ categoryLabel(row.category) }}</template>
            </el-table-column>
            <el-table-column prop="current_stock" label="库存(kg)" width="90" />
            <el-table-column label="温控" width="80">
              <template #default="{row}">{{ row.storage_temp_min }}~{{ row.storage_temp_max }}°C</template>
            </el-table-column>
            <el-table-column label="保质期" width="80">
              <template #default="{row}">{{ row.shelf_life_days }}天</template>
            </el-table-column>
            <el-table-column label="库存状态" min-width="120">
              <template #default="{row}">
                <el-progress :percentage="Math.min(100, row.current_stock / 50 * 100)" :color="stockBarColor(row)" :stroke-width="8" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{row}">
                <el-button size="small" link type="primary" @click="openStockIn(row)">入库</el-button>
                <el-button size="small" link type="warning" @click="openStockOut(row)">出库</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="expiry">
          <template #label>
            <span>临期预警<el-badge v-if="expiryAlerts.length" :value="expiryAlerts.length" style="margin-left:6px" /></span>
          </template>
          <el-empty v-if="expiryAlerts.length === 0" description="无临期预警" :image-size="60" />
          <div v-else class="expiry-list">
            <div v-for="a in expiryAlerts" :key="a.product_id + '-' + a.batch_date" :class="['expiry-card', 'expiry-' + a.level]">
              <el-row align="middle">
                <el-col :span="4"><el-tag :type="a.level === 'red' ? 'danger' : a.level === 'orange' ? 'warning' : ''" size="small">{{ levelLabel(a.level) }}</el-tag></el-col>
                <el-col :span="4"><span style="font-weight:600">{{ a.product_name }}</span></el-col>
                <el-col :span="3"><span style="font-size:12px;color:var(--text-secondary)">{{ a.sku_code }}</span></el-col>
                <el-col :span="3"><span>批次: {{ a.batch_date }}</span></el-col>
                <el-col :span="3"><span>库存: {{ a.quantity_at_risk }}kg</span></el-col>
                <el-col :span="3"><span>保质期{{ a.shelf_life_days }}天</span></el-col>
                <el-col :span="4">
                  <span :style="{ color: a.days_remaining <= 0 ? 'var(--color-danger)' : a.days_remaining <= 1 ? 'var(--color-warning)' : 'var(--text-regular)', fontWeight: 'bold' }">
                    {{ a.days_remaining <= 0 ? '已过期' : '剩' + a.days_remaining + '天' }}
                  </span>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="出入库记录" name="transactions">
          <el-table :data="transactions" stripe size="small">
            <el-table-column prop="created_at" label="时间" width="160" />
            <el-table-column label="类型" width="60">
              <template #default="{row}"><el-tag :type="row.type==='in'?'success':'danger'" size="small">{{ row.type==='in'?'入库':'出库' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="product_name" label="品名" width="120" />
            <el-table-column prop="sku_code" label="SKU" width="100" />
            <el-table-column prop="quantity_kg" label="数量(kg)" width="90" />
            <el-table-column prop="notes" label="备注" min-width="140" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- Stock In Dialog -->
    <el-dialog v-model="showStockIn" title="入库登记" width="400px">
      <el-form label-width="80px">
        <el-form-item label="商品"><el-input :model-value="stockTarget?.name" disabled /></el-form-item>
        <el-form-item label="数量(kg)"><el-input-number v-model="stockQty" :min="1" :max="99999" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="stockNote" placeholder="批次/来源" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showStockIn = false">取消</el-button><el-button type="primary" @click="doStockIn" :loading="stockLoading">确认入库</el-button></template>
    </el-dialog>

    <!-- Stock Out Dialog -->
    <el-dialog v-model="showStockOut" title="出库登记" width="400px">
      <el-form label-width="80px">
        <el-form-item label="商品"><el-input :model-value="stockTarget?.name" disabled /></el-form-item>
        <el-form-item label="数量(kg)"><el-input-number v-model="stockQty" :min="1" :max="stockTarget?.current_stock || 99999" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="stockNote" placeholder="出库原因" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showStockOut = false">取消</el-button><el-button type="primary" @click="doStockOut" :loading="stockLoading">确认出库</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import client from '../../api/client'

const activeTab = ref('inventory')
const dashboard = ref({})
const inventory = ref([])
const expiryAlerts = ref([])
const transactions = ref([])
const showStockIn = ref(false)
const showStockOut = ref(false)
const stockTarget = ref(null)
const stockQty = ref(1)
const stockNote = ref('')
const stockLoading = ref(false)

const categoryLabel = (c) => ({ tea:'茶叶', vegetable:'蔬菜', fruit:'水果', meat:'肉类', other:'其他' }[c] || c)
const levelLabel = (l) => ({ red:'严重', orange:'警告', yellow:'注意' }[l] || l)

function stockBarColor(row) {
  if (row.current_stock <= 5) return 'var(--color-danger)'
  if (row.current_stock <= 20) return 'var(--color-warning)'
  return 'var(--color-primary)'
}

async function loadDashboard() {
  try { dashboard.value = await client.get('/warehouse/dashboard') } catch (e) { console.error('[Warehouse] dashboard', e) }
}

async function loadInventory() {
  try { inventory.value = await client.get('/warehouse/inventory') } catch (e) { console.error('[Warehouse] inventory', e) }
}

async function loadExpiry() {
  try { expiryAlerts.value = await client.get('/warehouse/expiry-alerts?days=3') } catch (e) { console.error('[Warehouse] expiry', e) }
}

async function loadTransactions() {
  try { transactions.value = await client.get('/warehouse/transactions?limit=50') } catch (e) { console.error('[Warehouse] transactions', e) }
}

function openStockIn(row) { stockTarget.value = row; stockQty.value = 1; stockNote.value = ''; showStockIn.value = true }
function openStockOut(row) { stockTarget.value = row; stockQty.value = 1; stockNote.value = ''; showStockOut.value = true }

async function doStockIn() {
  if (stockLoading.value) return
  stockLoading.value = true
  try {
    await client.post('/warehouse/stock-in', { product_id: stockTarget.value.id, quantity_kg: stockQty.value, notes: stockNote.value })
    ElMessage.success('入库成功')
    showStockIn.value = false
    loadDashboard(); loadInventory(); loadTransactions()
  } catch (e) { ElMessage.error('入库失败') }
  finally { stockLoading.value = false }
}

async function doStockOut() {
  if (stockLoading.value) return
  stockLoading.value = true
  try {
    await client.post('/warehouse/stock-out', { product_id: stockTarget.value.id, quantity_kg: stockQty.value, notes: stockNote.value })
    ElMessage.success('出库成功')
    showStockOut.value = false
    loadDashboard(); loadInventory(); loadTransactions(); loadExpiry()
  } catch (e) { ElMessage.error('出库失败') }
  finally { stockLoading.value = false }
}

onMounted(() => {
  loadDashboard(); loadInventory(); loadExpiry(); loadTransactions()
})
</script>

<style scoped>
.kpi-row { display: flex; gap: var(--spacing-sm); }
.kpi-card { flex: 1; background: var(--bg-card); border-radius: var(--radius-md); padding: 16px; text-align: center; box-shadow: var(--shadow-sm); }
.kpi-value { font-size: 28px; font-weight: bold; color: var(--text-primary); }
.kpi-unit { font-size: 14px; font-weight: normal; color: var(--text-secondary); }
.kpi-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.kpi-warn { border-left: 3px solid var(--color-warning); }
.kpi-warn .kpi-value { color: var(--color-warning); }
.expiry-list { display: flex; flex-direction: column; gap: 8px; }
.expiry-card { padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid; }
.expiry-red { background: var(--alert-red-bg); border-color: var(--alert-red); }
.expiry-orange { background: var(--alert-orange-bg); border-color: var(--alert-orange); }
.expiry-yellow { background: var(--alert-yellow-bg); border-color: var(--alert-yellow); }
</style>
