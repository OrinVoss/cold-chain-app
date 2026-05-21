<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo-area">
        <span class="logo-icon">❄</span>
        <h1>徽农优选冷链助手</h1>
        <p>司机端 · 移动工作台</p>
      </div>
      <van-cell-group inset>
        <van-field v-model="form.username" label="用户名" placeholder="请输入用户名" />
        <van-field v-model="form.password" label="密码" type="password" placeholder="请输入密码" />
      </van-cell-group>
      <div style="padding:16px">
        <van-button type="primary" block round :loading="loading" @click="handleLogin">登 录</van-button>
      </div>
      <div class="demo-tip">
        <p>演示账号：driver1 / 123456</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import client from '../api/client'

const router = useRouter()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function handleLogin() {
  if (!form.username || !form.password) {
    showToast('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await client.post('/auth/login', form)
    localStorage.setItem('token', res.token)
    localStorage.setItem('display_name', res.user.display_name)
    localStorage.setItem('role', res.user.role)
    showToast(`欢迎，${res.user.display_name}`)
    router.push('/home')
  } catch (e) {
    showToast(e.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page { height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1890ff, #36cfc9); }
.login-card { width: 90%; max-width: 360px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.15); }
.logo-area { text-align: center; padding: 30px 20px 20px; }
.logo-icon { font-size: 48px; }
.logo-area h1 { font-size: 20px; margin: 8px 0 4px; color: #303133; }
.logo-area p { font-size: 12px; color: #909399; }
.demo-tip { text-align: center; padding: 8px 16px 20px; }
.demo-tip p { font-size: 12px; color: #909399; }
</style>
