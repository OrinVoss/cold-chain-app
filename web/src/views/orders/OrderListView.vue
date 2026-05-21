<template>
  <div class="orders-page">
    <div class="toolbar">
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width:130px">
        <el-option label="待确认" value="pending" /><el-option label="已确认" value="confirmed" />
        <el-option label="处理中" value="processing" /><el-option label="运输中" value="in_transit" />
        <el-option label="已送达" value="delivered" />
      </el-select>
      <el-button type="primary" @click="showCreate = true">创建订单</el-button>
      <el-button @click="loadOrders">刷新</el-button>
    </div>

    <el-card shadow="never" style="margin-top:12px">
      <el-table :data="filteredOrders" v-loading="loading" stripe>
        <el-table-column prop="order_number" label="订单号" width="180" />
        <el-table-column prop="customer_name" label="客户" width="140" />
        <el-table-column prop="delivery_city" label="目的地" width="80">
          <template #default="{row}">{{ row.delivery_city === 'shanghai' ? '上海' : '杭州' }}</template>
        </el-table-column>
        <el-table-column prop="delivery_address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column label="商品" min-width="140" show-overflow-tooltip>
          <template #default="{row}">{{ row.product_summary || row.items?.map(i=>i.product_name).join('、') }}</template>
        </el-table-column>
        <el-table-column label="温控" width="100">
          <template #default="{row}">{{ row.required_temp_min }}~{{ row.required_temp_max }}°C</template>
        </el-table-column>
        <el-table-column prop="total_weight_kg" label="重量" width="70" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{row}">
            <div class="action-cell">
              <el-button size="small" link type="primary" @click="$router.push('/orders/' + row.id)">详情</el-button>
              <el-dropdown trigger="click" v-if="row.status==='pending' || row.status==='confirmed'">
                <span class="more-btn" title="更多操作"><el-icon><MoreFilled /></el-icon></span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="row.status==='pending'" @click="confirmOrder(row.id)">确认</el-dropdown-item>
                    <el-dropdown-item v-if="row.status==='pending'||row.status==='confirmed'" @click="cancelOrder(row.id)" style="color:#f5222d">取消</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <span v-else class="more-btn-placeholder"></span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreate" title="创建订单" width="550px">
      <el-form :model="newOrder" label-width="90px">
        <el-row><el-col :span="12"><el-form-item label="客户"><el-input v-model="newOrder.customer_name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="电话"><el-input v-model="newOrder.customer_phone" /></el-form-item></el-col></el-row>
        <el-row><el-col :span="12"><el-form-item label="目的地">
          <el-select v-model="newOrder.delivery_city"><el-option label="上海" value="shanghai" /><el-option label="杭州" value="hangzhou" /></el-select>
        </el-form-item></el-col>
        <el-col :span="12"><el-form-item label="温控°C"><el-input-number v-model="newOrder.required_temp_min" :min="0" :max="10" style="width:45%" /> ~ <el-input-number v-model="newOrder.required_temp_max" :min="0" :max="10" style="width:45%" /></el-form-item></el-col></el-row>
        <el-form-item label="地址"><el-input v-model="newOrder.delivery_address" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="newOrder.notes" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showCreate = false">取消</el-button><el-button type="primary" @click="createOrder">创建</el-button></template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import client from '../../api/client'

const orders = ref([])
const loading = ref(false)
const filterStatus = ref('')
const showCreate = ref(false)
const newOrder = ref({ customer_name:'', customer_phone:'', delivery_city:'hangzhou', delivery_address:'', required_temp_min:0, required_temp_max:4, notes:'' })

const filteredOrders = computed(() => filterStatus.value ? orders.value.filter(o => o.status === filterStatus.value) : orders.value)
const statusLabel = (s) => ({ pending:'待确认', confirmed:'已确认', processing:'处理中', in_transit:'运输中', delivered:'已送达', cancelled:'已取消' }[s]||s)
const statusType = (s) => ({ pending:'warning', confirmed:'primary', in_transit:'warning', delivered:'success', cancelled:'danger' }[s]||'')

async function loadOrders() { loading.value = true; try { orders.value = await client.get('/orders') } catch (e) { ElMessage.error('加载失败') } finally { loading.value = false } }
async function confirmOrder(id) { try { await ElMessageBox.confirm('确认该订单？', '提示', { type: 'warning' }); await client.put(`/orders/${id}/status`,{status:'confirmed'}); ElMessage.success('已确认'); loadOrders() } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') } }
async function cancelOrder(id) { try { await ElMessageBox.confirm('确认取消？','提示',{type:'warning'}); await client.put(`/orders/${id}/cancel`); ElMessage.success('已取消'); loadOrders() } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败') } }
async function createOrder() { try { await client.post('/orders', newOrder.value); ElMessage.success('已创建'); showCreate.value = false; newOrder.value = { customer_name:'', customer_phone:'', delivery_city:'hangzhou', delivery_address:'', required_temp_min:0, required_temp_max:4, notes:'' }; loadOrders() } catch (e) { ElMessage.error('创建失败') } }

onMounted(loadOrders)
</script>

<style scoped>
.toolbar { display: flex; gap: var(--spacing-sm); align-items: center; background: var(--bg-card); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.action-cell { display: flex; align-items: center; justify-content: center; gap: 4px; }
.action-cell :deep(.el-button) { height: 24px; }
.more-btn { cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--radius-sm); color: var(--color-primary); background: var(--color-primary-bg); border: 1px solid var(--color-primary-light); }
.more-btn:hover { background: #dbe7ff; }
.more-btn-placeholder { display: inline-block; width: 24px; height: 24px; }
.order-desc :deep(.el-descriptions__cell) { vertical-align: middle !important; height: 40px !important; }
.order-desc :deep(.el-descriptions__label) { vertical-align: middle !important; }
.order-desc :deep(.el-descriptions__content) { vertical-align: middle !important; }
.order-desc :deep(.el-tag) { vertical-align: middle !important; }
</style>
