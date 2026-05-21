import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/auth/LoginView.vue') },
  {
    path: '/',
    component: () => import('../components/layout/DashboardLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/dashboard/OverviewView.vue'), meta: { title: '概览仪表盘' } },
      { path: 'monitoring', name: 'Monitoring', component: () => import('../views/monitoring/TempMonitorView.vue'), meta: { title: '温度监控' } },
      { path: 'orders', name: 'Orders', component: () => import('../views/orders/OrderListView.vue'), meta: { title: '订单管理' } },
      { path: 'shipments', name: 'Shipments', component: () => import('../views/shipments/ShipmentListView.vue'), meta: { title: '运输追踪' } },
      { path: 'alerts', name: 'Alerts', component: () => import('../views/alerts/AlertCenterView.vue'), meta: { title: '告警中心' } },
      { path: 'dispatch', name: 'Dispatch', component: () => import('../views/dispatch/DispatchBoardView.vue'), meta: { title: '智能调度' } },
      { path: 'warehouse', name: 'Warehouse', component: () => import('../views/warehouse/InventoryView.vue'), meta: { title: '仓储管理' } },
      { path: 'orders/:id', name: 'OrderDetail', component: () => import('../views/orders/OrderDetailView.vue'), meta: { title: '订单详情' } }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
