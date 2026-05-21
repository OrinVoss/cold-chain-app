import { ref } from 'vue'
import { io } from 'socket.io-client'

let socket = null
let connectionCount = 0

export function useSocket() {
  const connected = ref(false)

  function connect(token) {
    if (!token) return
    connectionCount++
    if (socket) {
      connected.value = socket.connected
      return
    }
    socket = io('/', { path: '/socket.io', auth: { token } })
    socket.on('connect', () => { connected.value = true })
    socket.on('disconnect', () => { connected.value = false })
  }

  function on(event, handler) {
    if (!socket) return
    socket.on(event, handler)
  }

  function off(event, handler) {
    if (!socket) return
    socket.off(event, handler)
  }

  function disconnect() {
    connectionCount--
    if (connectionCount <= 0 && socket) {
      socket.disconnect()
      socket = null
      connected.value = false
    }
  }

  return { connected, connect, on, off, disconnect }
}
