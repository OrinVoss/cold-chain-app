import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue') },
  {
    path: '/',
    component: () => import('../components/layout/MobileLayout.vue'),
    redirect: '/home',
    children: [
      { path: 'home', name: 'Home', component: () => import('../views/HomeView.vue') },
      { path: 'tasks', name: 'Tasks', component: () => import('../views/TaskListView.vue') },
      { path: 'tasks/:id', name: 'TaskDetail', component: () => import('../views/TaskDetailView.vue') },
      { path: 'monitor', name: 'Monitor', component: () => import('../views/TempMonitorView.vue') },
      { path: 'alerts', name: 'Alerts', component: () => import('../views/AlertListView.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/ProfileView.vue') }
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
    next('/home')
  } else {
    next()
  }
})

export default router
