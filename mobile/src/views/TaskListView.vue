<template>
  <div class="task-list-page">
    <van-tabs v-model:active="activeTab" sticky>
      <van-tab :title="'进行中(' + activeTasks.length + ')'" />
      <van-tab title="已分配" />
    </van-tabs>

    <div class="task-items" v-if="displayTasks.length > 0">
      <van-cell-group inset v-for="task in displayTasks" :key="task.id">
        <van-cell :title="task.shipment_code" :label="task.plate_number + ' | ' + statusCN(task.status)" is-link @click="$router.push('/tasks/' + task.id)">
          <template #value>
            <div class="task-progress">
              <span class="task-stops">{{ task.delivered_stops || 0 }}/{{ task.total_stops || 0 }} 站</span>
              <span v-if="task.status==='in_transit'" class="task-live">● 运输中</span>
            </div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <van-empty v-else description="暂无任务" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showToast } from 'vant'
import { io } from 'socket.io-client'
import client from '../api/client'

const tasks = ref([])
const activeTab = ref(0)
let socket = null

const statusCN = (s) => ({ assigned:'待出发', loaded:'已装车', in_transit:'运输中', arrived:'已到达', completed:'已完成' }[s] || s)
const activeTasks = computed(() => tasks.value.filter(t => t.status === 'in_transit'))
const assignedTasks = computed(() => tasks.value.filter(t => t.status !== 'in_transit'))
const displayTasks = computed(() => activeTab.value === 0 ? activeTasks.value : assignedTasks.value)

onMounted(async () => {
  try {
    tasks.value = await client.get('/driver/tasks')
  } catch (e) { console.error(e); showToast('加载失败'); }

  const token = localStorage.getItem('token')
  socket = io('/', { path: '/socket.io', auth: { token } })
  socket.on('shipment:status-change', () => {
    client.get('/driver/tasks').then(res => { tasks.value = res })
  })
})

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.task-list-page { padding-bottom: 60px; }
.task-items { margin-top: 12px; }
.task-stops { font-size: 13px; color: #606266; }
.task-live { font-size: 12px; color: #67c23a; margin-left: 8px; }
.task-progress { display: flex; align-items: center; gap: 8px; }
</style>
