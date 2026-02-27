// Импорт утилит для работы с URL и путями файлов в Node.js
import { fileURLToPath, URL } from 'node:url'
// Импорт функции для определения конфигурации Vite
import { defineConfig } from 'vite'
// Импорт плагина Vue для Vite
import vue from '@vitejs/plugin-vue'
// Импорт плагина инструментов разработчика Vue (Vue DevTools)
import vueDevTools from 'vite-plugin-vue-devtools'
// Конфигурация Vite для проекта
// Документация: https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig({
// Плагины Vite

  plugins: [
    vue(),  // Основной плагин для поддержки Vue
    vueDevTools(), // Инструменты разработчика Vue (удобная отладка)
  ],
  // Настройки разрешения модулей
  resolve: {
    alias: {
      // Создание алиаса '@' для папки src
       // Позволяет импортировать файлы как '@/components/MyComponent.vue'
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
   // Настройки сервера разработки
  server: {
    proxy: {
      // Прокси для API запросов
      '/api': {
        target: 'http://localhost:3001',// Адрес бэкенд-сервера
        changeOrigin: true, // Изменение источника запроса
      },
    },
  },
})
