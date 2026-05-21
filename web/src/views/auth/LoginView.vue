<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <span class="login-icon">❄</span>
        <h1>徽农优选冷链物流管理系统</h1>
        <p>Huizhou Agricultural Premium Cold Chain</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading" style="width:100%">登 录</el-button>
        </el-form-item>
      </el-form>
      <div class="demo-accounts">
        <p>演示账号：admin / admin123</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import client from '../../api/client'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (loading.value) return
  try { await formRef.value.validate() } catch { return }
  loading.value = true
  try {
    const res = await client.post('/auth/login', form)
    localStorage.setItem('token', res.token)
    localStorage.setItem('display_name', res.user.display_name)
    localStorage.setItem('role', res.user.role)
    ElMessage.success(`欢迎回来，${res.user.display_name}`)
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--sidebar-bg) 0%, var(--color-primary) 100%); }
.login-card { width: 420px; padding: 40px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
.login-header { text-align: center; margin-bottom: 30px; }
.login-icon { font-size: 48px; }
.login-header h1 { font-size: 22px; margin: var(--spacing-sm) 0 4px; color: var(--text-primary); }
.login-header p { font-size: 12px; color: var(--text-secondary); }
.demo-accounts { margin-top: var(--spacing-md); text-align: center; }
.demo-accounts p { font-size: 12px; color: var(--text-secondary); line-height: 1.8; }
</style>
