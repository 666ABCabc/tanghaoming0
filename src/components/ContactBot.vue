<template>
  <article class="contact-panel">
    <!-- Заголовок с иконкой и кнопкой сброса -->
    <div class="contact-header">
      <div class="header-icon">
        <i class="fas fa-robot"></i>
      </div>
      <div class="header-text">
        <h2>Smart Contact Assistant</h2>
        <p class="header-sub">AI will guide you through the form</p>
      </div>
      <button v-if="isCompleted" class="reset-btn" @click="resetConversation" title="Start over">
        <i class="fas fa-redo"></i>
      </button>
    </div>

    <main>
      <!-- Индикатор прогресса сбора данных -->
      <div class="progress-bar-container">
        <div class="progress-info">
          <span>Collection Progress</span>
          <span>{{ filledCount }}/{{ totalRequired }}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="slot-tags">
          <span
            v-for="slot in requiredSlots"
            :key="slot.key"
            class="slot-tag"
            :class="{ filled: collectedData[slot.key] }"
          >
            <i :class="collectedData[slot.key] ? 'fas fa-check-circle' : 'far fa-circle'"></i>
            {{ slot.label }}
          </span>
        </div>
      </div>

      <!-- Контейнер сообщений чата -->
      <div class="chat-container" ref="chatContainer">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="chat-message"
          :class="msg.role === 'user' ? 'outcoming' : 'incoming'"
        >
          <div v-if="msg.role !== 'user'" class="avatar bot-avatar">
            <i class="fas fa-robot"></i>
          </div>
          <div class="bubble" :class="{ 'system-bubble': msg.isSystem }">
            {{ msg.content }}
          </div>
          <div v-if="msg.role === 'user'" class="avatar user-avatar">
            <i class="fas fa-user"></i>
          </div>
        </div>

        <!-- Индикатор печатания бота -->
        <div v-if="isThinking" class="chat-message incoming">
          <div class="avatar bot-avatar">
            <i class="fas fa-robot"></i>
          </div>
          <div class="bubble typing-bubble">
            <div class="typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Карточка с собранными данными (показывается после завершения) -->
      <div v-if="isCompleted" class="summary-card">
        <h3><i class="fas fa-clipboard-check"></i> Collected Information</h3>
        <div class="summary-grid">
          <div v-for="slot in allSlots" :key="slot.key" class="summary-item">
            <span class="summary-label">{{ slot.label }}</span>
            <span class="summary-value">{{ collectedData[slot.key] || '(not provided)' }}</span>
          </div>
        </div>
        <div class="summary-status">
          <span v-if="submitStatus === 'success'" class="status-success">
            <i class="fas fa-check-circle"></i> {{ submitMessage }}
          </span>
          <span v-else-if="submitStatus === 'error'" class="status-error">
            <i class="fas fa-exclamation-circle"></i> Submission failed, please try again
          </span>
          <span v-else-if="submitStatus === 'submitting'" class="status-pending">
            <i class="fas fa-spinner fa-spin"></i> Submitting...
          </span>
        </div>
        <button class="restart-btn" @click="resetConversation">
          <i class="fas fa-redo"></i> Collect New Contact Info
        </button>
      </div>

      <!-- Форма ввода -->
      <form class="input-form" @submit.prevent="handleUserInput">
        <input
          type="text"
          v-model="userInput"
          class="chat-input"
          :placeholder="isCompleted ? 'Information collected' : 'Type your answer...'"
          :disabled="isThinking || isCompleted"
        />
        <button
          type="submit"
          class="send-btn"
          :disabled="!userInput.trim() || isThinking || isCompleted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707z"/>
          </svg>
        </button>
      </form>
    </main>
  </article>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ChatSession } from '../services/deepseek.js'

// ==================== Состояние компонента ====================
const messages = ref([])                    // Массив сообщений чата
const userInput = ref('')                    // Текущий ввод пользователя
const isThinking = ref(false)                // Флаг "бот печатает"
const isCompleted = ref(false)               // Завершен ли сбор данных
const submitStatus = ref('')                  // Статус отправки: success/error/submitting
const submitMessage = ref('')                  // Сообщение о результате отправки
const chatContainer = ref(null)               // Ссылка на контейнер чата для прокрутки

// Конфигурация с сервера
const allSlots = ref([])                      // Все поля (слота) конфигурации
const requiredSlots = ref([])                  // Только обязательные поля
const greeting = ref('')                       // Приветственное сообщение
const completionMessage = ref('')               // Сообщение о завершении

// Собранные данные по слотам
const collectedData = ref({})                   // Объект с данными пользователя

// Текущий собираемый слот
const currentSlotIndex = ref(0)                 // Индекс текущего слота

// Сессия чата AI для умного извлечения данных
const chatSession = new ChatSession()

// ==================== Вычисляемые свойства ====================
const filledCount = computed(() => {
  return requiredSlots.value.filter(s => collectedData.value[s.key]).length
})

const totalRequired = computed(() => requiredSlots.value.length)

const progressPercent = computed(() => {
  if (totalRequired.value === 0) return 0
  return Math.round((filledCount.value / totalRequired.value) * 100)
})

// ==================== Жизненный цикл ====================
onMounted(async () => {
  await loadConfig()
  startConversation()
})

// Автопрокрутка при новых сообщениях
watch(messages, () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}, { deep: true })

// ==================== Методы ====================

// Загрузка конфигурации с сервера
async function loadConfig() {
  try {
    const res = await fetch('/api/contact-config.php')
    const data = await res.json()
    allSlots.value = data.slots || []
    requiredSlots.value = data.slots.filter(s => s.required) || []
    greeting.value = data.greeting || 'Hello! Please provide your contact information.'
    completionMessage.value = data.completionMessage || 'Thank you for your information!'
  } catch (err) {
    console.error('Failed to load contact config:', err)
    messages.value.push({
      role: 'assistant',
      content: 'Sorry, failed to load configuration. Please refresh the page.'
    })
  }
}

// Начало диалога с AI
function startConversation() {
  // Добавление приветствия
  messages.value.push({
    role: 'assistant',
    content: greeting.value
  })
  currentSlotIndex.value = 0

  // Формирование системного промпта для AI
  const slotDescriptions = allSlots.value.map(s => {
    return `- ${s.key}(${s.label}): ${s.required ? 'required' : 'optional'}, validation: ${s.validation || 'none'}`
  }).join('\n')

  chatSession.addSystemMessage(
    `You are a smart customer service assistant. Your task is to guide the user through a friendly conversation to collect the following contact information:
${slotDescriptions}

Important rules:
1. Ask for only one field at a time
2. If the user's reply contains information for a field, extract and confirm it
3. If the reply is irrelevant or incomplete, politely redirect
4. For optional fields, accept "skip" or "no" and move to the next field
5. Once all required fields are collected, summarize and confirm

You MUST embed JSON markers in your reply to identify extracted data:
[EXTRACTED:{"key":"value"}]
Example: if the user says "My name is John", reply with [EXTRACTED:{"name":"John"}]

To skip an optional field, include [SKIP:fieldKey]
Example: [SKIP:company]

Always reply in English. Be friendly and professional.`
  )
}

// Обработка ввода пользователя
async function handleUserInput() {
  const input = userInput.value.trim()
  if (!input || isThinking.value || isCompleted.value) return

  // Добавление сообщения пользователя
  messages.value.push({ role: 'user', content: input })
  userInput.value = ''
  isThinking.value = true

  try {
    // Контекст о том, что уже собрано и что ещё нужно
    const filled = Object.entries(collectedData.value)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')

    const remaining = allSlots.value
      .filter(s => !collectedData.value[s.key])
      .map(s => `${s.key}(${s.label})${s.required ? '[required]' : '[optional]'}`)
      .join(', ')

    const currentSlot = allSlots.value.find(s => !collectedData.value[s.key])

    // Подсказка контекста для AI
    const contextHint = `[System: Collected so far: ${filled || 'none'}. Still needed: ${remaining}. Currently collecting: ${currentSlot ? currentSlot.key + '(' + currentSlot.label + ')' : 'all done'}. User just said: "${input}"]`

    // Отправка в AI с контекстом
    const aiResponse = await chatSession.sendMessage(contextHint + '\nUser message: ' + input)

    // Поиск маркеров извлечения данных в ответе AI
    const extractedMatch = aiResponse.match(/\[EXTRACTED:\s*(\{[^}]+\})\s*\]/g)
    const skipMatch = aiResponse.match(/\[SKIP:(\w+)\]/g)

    // Очистка отображаемого сообщения от маркеров
    let displayMessage = aiResponse
      .replace(/\[EXTRACTED:\s*\{[^}]+\}\s*\]/g, '')
      .replace(/\[SKIP:\w+\]/g, '')
      .replace(/\[System:[^\]]*\]/g, '')
      .trim()

    // Обработка извлечённых данных
    if (extractedMatch) {
      for (const match of extractedMatch) {
        try {
          const jsonStr = match.match(/\[EXTRACTED:\s*(\{[^}]+\})\s*\]/)[1]
          const extracted = JSON.parse(jsonStr)
          for (const [key, value] of Object.entries(extracted)) {
            const slot = allSlots.value.find(s => s.key === key)
            if (slot) {
              // Валидация, если есть правило
              if (slot.validation) {
                const regex = new RegExp(slot.validation)
                if (regex.test(value)) {
                  collectedData.value[key] = value
                } else {
                  displayMessage += `\n\n⚠️ ${slot.validationMessage || 'Invalid format, please try again'}`
                }
              } else {
                collectedData.value[key] = value
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse extracted data:', e)
        }
      }
    }

    // Обработка пропусков
    if (skipMatch) {
      for (const match of skipMatch) {
        const key = match.match(/\[SKIP:(\w+)\]/)[1]
        const slot = allSlots.value.find(s => s.key === key)
        if (slot && !slot.required) {
          collectedData.value[key] = '(skipped)'
        }
      }
    }

    // Если AI не извлёк данные, пробуем простое извлечение
    if (!extractedMatch && !skipMatch && currentSlot) {
      const extracted = trySimpleExtract(input, currentSlot)
      if (extracted) {
        collectedData.value[currentSlot.key] = extracted
      }
    }

    messages.value.push({ role: 'assistant', content: displayMessage || 'Please continue providing your information.' })

    // Проверка, собраны ли все обязательные поля
    const allRequiredFilled = requiredSlots.value.every(s => collectedData.value[s.key])
    const allFilled = allSlots.value.every(s => collectedData.value[s.key])

    if (allRequiredFilled && allFilled) {
      await completeCollection()
    } else if (allRequiredFilled) {
      // Проверка, остались ли необязательные поля
      const remainingOptional = allSlots.value.filter(s => !s.required && !collectedData.value[s.key])
      if (remainingOptional.length === 0) {
        await completeCollection()
      }
    }

  } catch (err) {
    console.error('AI response error:', err)
    messages.value.push({
      role: 'assistant',
      content: 'Sorry, I encountered an issue. Please try again.'
    })
  } finally {
    isThinking.value = false
  }
}

// Простое извлечение данных без AI
function trySimpleExtract(input, slot) {
  if (!slot) return null
  const text = input.trim()

  switch (slot.type) {
    case 'phone': {
      const phoneMatch = text.match(/1[3-9]\d{9}/)
      return phoneMatch ? phoneMatch[0] : null
    }
    case 'email': {
      const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)
      return emailMatch ? emailMatch[0] : null
    }
    default: {
      if (slot.validation) {
        const regex = new RegExp(slot.validation)
        return regex.test(text) ? text : null
      }
      return text.length >= 1 ? text : null
    }
  }
}

// Завершение сбора данных
async function completeCollection() {
  isCompleted.value = true
  messages.value.push({
    role: 'assistant',
    content: completionMessage.value
  })

  // Отправка данных на сервер
  submitStatus.value = 'submitting'
  try {
    const res = await fetch('/api/contact-submit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectedData: collectedData.value })
    })
    const result = await res.json()
    if (result.success) {
      submitStatus.value = 'success'
      submitMessage.value = result.message
    } else {
      submitStatus.value = 'error'
    }
  } catch (err) {
    console.error('Submit error:', err)
    submitStatus.value = 'error'
  }
}

// Сброс диалога и начало заново
function resetConversation() {
  messages.value = []
  collectedData.value = {}
  currentSlotIndex.value = 0
  isCompleted.value = false
  submitStatus.value = ''
  submitMessage.value = ''
  chatSession.clearHistory()
  startConversation()
}
</script>

<style scoped>
.contact-panel {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #fff;
}

/* Заголовок */
.contact-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
}

.header-text h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.header-sub {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  opacity: 0.85;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Основная часть */
.contact-panel main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Индикатор прогресса */
.progress-bar-container {
  padding: 0.8rem 1.5rem;
  background: #fafbff;
  border-bottom: 1px solid #eee;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: #888;
  margin-bottom: 0.4rem;
}

.progress-track {
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.slot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.slot-tag {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  background: #f0f0f0;
  color: #999;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.3s;
}

.slot-tag.filled {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

/* Чат */
.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.2rem 1.5rem;
  background: #f7f8fa;
}

.chat-message {
  display: flex;
  align-items: flex-start;
  margin-bottom: 0.8rem;
  gap: 0.5rem;
}

.chat-message.incoming {
  justify-content: flex-start;
}

.chat-message.outcoming {
  justify-content: flex-end;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.bot-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.user-avatar {
  background: #e8e8e8;
  color: #666;
}

.bubble {
  padding: 0.7rem 1rem;
  border-radius: 16px;
  max-width: 70%;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.incoming .bubble {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-top-left-radius: 4px;
  color: #333;
}

.outcoming .bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-top-right-radius: 4px;
}

.system-bubble {
  background: #fff8e1 !important;
  border-color: #ffe082 !important;
  color: #795548 !important;
  font-size: 0.82rem !important;
}

.typing-bubble {
  padding: 0.8rem 1.2rem;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: blink 1s infinite alternate;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  from { opacity: 0.2; }
  to { opacity: 1; }
}

/* Карточка сводки */
.summary-card {
  margin: 0;
  padding: 1rem 1.5rem;
  background: #fafbff;
  border-top: 1px solid #e8e8e8;
}

.summary-card h3 {
  margin: 0 0 0.8rem;
  font-size: 0.95rem;
  color: #667eea;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0.6rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #eee;
}

.summary-label {
  font-size: 0.7rem;
  color: #999;
  margin-bottom: 0.15rem;
}

.summary-value {
  font-size: 0.85rem;
  color: #333;
  font-weight: 500;
}

.summary-status {
  margin-top: 0.8rem;
  font-size: 0.82rem;
}

.restart-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1rem;
  padding: 0.7rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}

.restart-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.status-success {
  color: #4caf50;
}

.status-error {
  color: #f44336;
}

.status-pending {
  color: #ff9800;
}

/* Форма ввода */
.input-form {
  display: flex;
  gap: 0.6rem;
  padding: 0.8rem 1.5rem;
  background: #fff;
  border-top: 1px solid #e8e8e8;
}

.chat-input {
  flex: 1;
  padding: 0.7rem 1rem;
  border: 1px solid #ddd;
  border-radius: 24px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #f7f8fa;
}

.chat-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  background: #fff;
}

.chat-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>