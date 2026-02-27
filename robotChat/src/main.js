// Импорт функции для создания приложения из Vue
import { createApp } from 'vue'
// Импорт корневого компонента приложения
import App from './App.vue'
// Импорт основных стилей
import './assets/main.css'
// Создание экземпляра приложения Vue с корневым компонентом App
const app = createApp(App)
// Монтирование приложения в элемент с id="app" в HTML
app.mount('#app')
