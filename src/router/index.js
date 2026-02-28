// Импорт функций для создания маршрутизатора из библиотеки vue-router
import { createRouter, createWebHistory } from 'vue-router'
// Создание экземпляра маршрутизатора
const router = createRouter({
  // Использование режима истории HTML5 (красивые URL без #)
  history: createWebHistory(import.meta.env.BASE_URL),
  // Массив маршрутов приложения (пока пустой)
  routes: [],
})
// Экспорт созданного маршрутизатора для использования в приложении

export default router
