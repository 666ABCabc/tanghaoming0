<template>
  <div class="app-wrapper">
    <!-- Навигация по вкладкам -->
    <nav class="tab-nav">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'contact' }"
        @click="activeTab = 'contact'"
      >
        <i class="fas fa-address-book"></i>
        <span>Contact Assistant</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        <i class="fas fa-comments"></i>
        <span>AI Chat</span>
      </button>
    </nav>

    <!-- Контактный бот -->
    <ContactBot v-if="activeTab === 'contact'" />

    <!-- Панель чата -->
    <div v-if="activeTab === 'chat'" class="chat-panel">
      <div class="chat-header">
        <div class="header-icon"><i class="fas fa-robot"></i></div>
        <div class="header-text">
          <h2>AI Chat Assistant</h2>
          <p>Powered by DeepSeek AI</p>
        </div>
      </div>

      <div class="chat-body">
        <!-- Сообщения -->
        <div class="chat-container">
          <div
            v-for="(user_message, index) in user_messages"
            :key="index"
            class="chat-message"
            :class="user_message.role === 'user' ? 'outcoming' : 'incoming'"
          >
            <div v-if="user_message.role !== 'user'" class="avatar bot-avatar">
              <i class="fas fa-robot"></i>
            </div>
            <div
              class="bubble markdown-body"
              v-html="renderMd(user_message.message)"
            ></div>
            <div v-if="user_message.role === 'user'" class="avatar user-avatar">
              <i class="fas fa-user"></i>
            </div>
          </div>

          <!-- Индикатор печатания -->
          <div v-if="is_sending" class="chat-message incoming">
            <div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="bubble typing-bubble">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Баннер ошибки -->
        <div v-if="error_messages" class="error-banner">
          <i class="fas fa-exclamation-circle"></i>
          <span>{{ error_messages }}</span>
          <button @click="error_messages = ''" class="close-error">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Форма ввода -->
        <form class="input-form" @submit.prevent="sendMessage">
          <input
            type="text"
            v-model="message"
            class="chat-input"
            placeholder="Type a message and press Enter…"
          />
          <button
            type="submit"
            class="send-btn"
            :disabled="!message || is_sending"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707z"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import ContactBot from './components/ContactBot.vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { ChatSession } from './services/deepseek.js'

// Активная вкладка
const activeTab = ref('contact')

// Настройка Markdown
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const i = tokens[idx].attrIndex('target')
  if (i < 0) tokens[idx].attrPush(['target', '_blank'])
  else tokens[idx].attrs[i][1] = '_blank'
  return self.renderToken(tokens, idx, options)
}

// Функция рендеринга Markdown с очисткой
const renderMd = (text) => {
  const s = String(text ?? '')
  const hasParagraphs = /\n\s*\n/.test(s)
  const html = hasParagraphs ? md.render(s) : md.renderInline(s)
  return DOMPurify.sanitize(html)
}

// Состояние чата
const message = ref('')               // Текущее сообщение
const user_messages = ref([])         // Массив сообщений
const is_sending = ref(false)         // Флаг отправки
const error_messages = ref('')        // Текст ошибки
const chatSession = new ChatSession() // Сессия чата

// Восстановление истории при монтировании
onMounted(() => {
  const raw = sessionStorage.getItem('user_messages')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      user_messages.value = parsed
      chatSession.restoreFromHistory(parsed)
    } catch {
      user_messages.value = []
      sessionStorage.removeItem('user_messages')
    }
  }
})

// Прокрутка вниз
function scrollToBottom() {
  nextTick(() => {
    const container = document.querySelector('.chat-container')
    if (container) container.scrollTop = container.scrollHeight
  })
}

// Отправка сообщения
async function sendMessage() {
  if (message.value === '' || is_sending.value) return

  user_messages.value.push({ role: 'user', message: message.value })
  saveToSession()
  scrollToBottom()

  const message_priv = message.value
  message.value = ''
  is_sending.value = true

  const response_message = await getServerResponse(message_priv)
  is_sending.value = false

  user_messages.value.push({ role: 'assistant', message: response_message })
  saveToSession()
  scrollToBottom()
}

// Получение ответа от сервера
async function getServerResponse(message_priv) {
  try {
    const response = await chatSession.sendMessage(message_priv)
    error_messages.value = ''
    return response
  } catch (error) {
    console.error('DeepSeek API Error:', error)
    error_messages.value = error.message
    return `抱歉，我遇到了一些问题：${error.message}\n\n请稍后再试。`
  }
}

// Сохранение в sessionStorage
function saveToSession() {
  sessionStorage.setItem('user_messages', JSON.stringify(user_messages.value))
}
</script>

<style scoped>
/* ===== Основной контейнер ===== */
.app-wrapper {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-shadow: 0 4px 40px rgba(102, 126, 234, 0.12);
}

/* ===== Навигация по вкладкам ===== */
.tab-nav {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #eaecf4;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #667eea;
  background: #f7f8ff;
}

.tab-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: #f7f8ff;
}

.tab-btn i {
  font-size: 1rem;
}

/* ===== Панель чата ===== */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  flex-shrink: 0;
}

.header-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.header-text h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.header-text p {
  font-size: 0.75rem;
  opacity: 0.8;
  margin: 0.1rem 0 0;
}

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ===== Список сообщений ===== */
.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.chat-message {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.chat-message.incoming { justify-content: flex-start; }
.chat-message.outcoming { justify-content: flex-end; }

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.bot-avatar {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.user-avatar {
  background: #e5e7eb;
  color: #6b7280;
}

.bubble {
  padding: 0.7rem 1rem;
  border-radius: 18px;
  max-width: 70%;
  font-size: 0.92rem;
  line-height: 1.6;
  word-break: break-word;
}

.incoming .bubble {
  background: #fff;
  border: 1px solid #e8eaf0;
  border-bottom-left-radius: 4px;
  color: #1f2937;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.outcoming .bubble {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

/* ===== Анимация печатания ===== */
.typing-bubble { padding: 0.8rem 1.2rem; }

.typing-dots { display: flex; gap: 4px; align-items: center; }

.typing-dots span {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #aaa;
  animation: blink 1.2s infinite alternate;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  from { opacity: 0.2; transform: scale(0.8); }
  to   { opacity: 1;   transform: scale(1.1); }
}

/* ===== Баннер ошибки ===== */
.error-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1.5rem;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.85rem;
}

.error-banner span { flex: 1; }

.close-error {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  padding: 0.2rem;
  display: flex;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.close-error:hover { opacity: 1; }

/* ===== Форма ввода ===== */
.input-form {
  display: flex;
  gap: 0.6rem;
  padding: 1rem 1.5rem;
  background: #fff;
  border-top: 1px solid #eaecf4;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  padding: 0.7rem 1.1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 24px;
  font-size: 0.92rem;
  outline: none;
  background: #f9fafb;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-input:focus {
  border-color: #667eea;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.07);
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.45);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ===== Стили для Markdown содержимого ===== */
.bubble.markdown-body :deep(p) { margin: 0 0 0.4em; }
.bubble.markdown-body :deep(p:last-child) { margin: 0; }
.bubble.markdown-body :deep(code) {
  background: rgba(0,0,0,0.08);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-size: 0.88em;
}
.bubble.markdown-body :deep(pre) {
  background: rgba(0,0,0,0.08);
  padding: 0.7em 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.outcoming .bubble.markdown-body :deep(code),
.outcoming .bubble.markdown-body :deep(pre) {
  background: rgba(255,255,255,0.15);
}
.bubble.markdown-body :deep(ul),
.bubble.markdown-body :deep(ol) {
  padding-left: 1.4em;
  margin: 0.3em 0;
}
.bubble.markdown-body :deep(a) { color: inherit; text-decoration: underline; }
</style>