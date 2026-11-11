import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
    // 单进程跑测试：用例量小收益不大，但可避免多 worker 下的文件句柄竞争问题
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
