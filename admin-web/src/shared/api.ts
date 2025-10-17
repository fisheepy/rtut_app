import axios from 'axios'
export const api = axios.create({
  baseURL: '/api',          // 开发期由 Vite 代理，生产期同域 /api
  withCredentials: true,    // 如果后端用 Cookie 会话
})
