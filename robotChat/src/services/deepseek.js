// Модуль сервиса DeepSeek API — вызывает прокси бэкенда, НЕ напрямую DeepSeek

const API_CHAT_URL = '/api/chat.php';
//const API_CHAT_URL = '/api/chat';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;           // базовая задержка 1 секунда
const REQUEST_TIMEOUT_MS = 60_000;  // таймаут запроса 60 секунд на попытку
const MAX_CONTEXT_MESSAGES = 40;    // хранить последние N сообщений

/**
 * Функция задержки
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Определяет, можно ли повторить запрос при данном HTTP статусе
 * 401/403 → не повторять (проблемы аутентификации/авторизации)
 * 429     → можно повторить, учитывать Retry-After
 * 5xx     → можно повторить
 */
function isRetryable(status) {
  if (status === 429) return true;
  return status >= 500;
}

/**
 * Обрезает список сообщений, сохраняет system сообщения + последние N не-system сообщений
 */
function trimMessages(messages, limit = MAX_CONTEXT_MESSAGES) {
  if (messages.length <= limit) return messages;
  const systemMsgs = messages.filter(m => m.role === 'system');
  const nonSystem  = messages.filter(m => m.role !== 'system');
  return [...systemMsgs, ...nonSystem.slice(-limit)];
}

/**
 * Отправляет сообщение на прокси бэкенда /api/chat
 * @param {Array} messages - массив истории сообщений
 * @param {Object} options - опциональные настройки
 * @returns {Promise<string>} - содержимое ответа API
 */
export async function sendMessage(messages, options = {}) {
  const {
    model = 'deepseek-chat',
    temperature = 0.7,
    maxTokens = 2000,
    retries = MAX_RETRIES
  } = options;

  // Внедрение языковой инструкции: отвечать на том же языке, на котором задан вопрос
  const LANG_SYSTEM_MSG = {
    role: 'system',
    content: 'Always respond in the same language as the user\'s message. If the user writes in Chinese, respond in Chinese. If the user writes in English, respond in English. Follow this rule strictly for every reply.'
  };
  const hasLangInstruction = messages.some(
    m => m.role === 'system' && m.content.includes('same language')
  );
  const messagesWithLang = hasLangInstruction
    ? messages
    : [LANG_SYSTEM_MSG, ...messages];

  const trimmed = trimMessages(messagesWithLang);
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(API_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmed, model, temperature, maxTokens }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        const msg = errorData.error || `API request failed: ${status} ${response.statusText}`;

        // Неповторяемые статусы → сразу выбрасываем ошибку
        if (!isRetryable(status)) {
          throw new Error(msg);
        }

        // 429 → используем Retry-After (если есть)
        if (status === 429) {
          const retryAfter = errorData.retryAfter
            ? parseInt(errorData.retryAfter, 10) * 1000
            : RETRY_DELAY * Math.pow(2, attempt);
          if (attempt < retries - 1) {
            console.warn(`429 rate limit, waiting ${retryAfter}ms before retry...`);
            await delay(retryAfter);
            continue;
          }
        }

        // 5xx → экспоненциальная задержка
        throw new Error(msg);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API response format');
      }

      return data.choices[0].message.content;

    } catch (error) {
      clearTimeout(timer);

      if (error.name === 'AbortError') {
        lastError = new Error('Request timeout, please try again later');
      } else {
        lastError = error;
      }

      console.error(`Attempt ${attempt + 1}/${retries} failed:`, lastError.message);

      // Если не последняя попытка, ждём и повторяем
      if (attempt < retries - 1) {
        const waitTime = RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
      }
    }
  }

  throw new Error(`API call failed (retried ${retries} times): ${lastError.message}`);
}

/**
 * Создание чат-сессии
 */
export class ChatSession {
  constructor() {
    this.messages = [];
  }

  /**
   * Восстановление контекста сессии из существующей истории
   * @param {Array} uiMessages - массив сообщений UI [{role,message},...]
   */
  restoreFromHistory(uiMessages) {
    this.messages = [];
    for (const m of uiMessages) {
      this.messages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.message
      });
    }
  }

  /**
   * Добавление сообщения пользователя
   */
  addUserMessage(content) {
    this.messages.push({
      role: 'user',
      content
    });
  }

  /**
   * Добавление сообщения ассистента
   */
  addAssistantMessage(content) {
    this.messages.push({
      role: 'assistant',
      content
    });
  }

  /**
   * Добавление системного сообщения
   */
  addSystemMessage(content) {
    this.messages.push({
      role: 'system',
      content
    });
  }

  /**
   * Отправка сообщения и получение ответа
   */
  async sendMessage(userMessage, options = {}) {
    this.addUserMessage(userMessage);

    try {
      const response = await sendMessage(this.messages, options);
      this.addAssistantMessage(response);
      return response;
    } catch (error) {
      // В случае ошибки удаляем только что добавленное сообщение пользователя
      this.messages.pop();
      throw error;
    }
  }

  /**
   * Получение истории диалога
   */
  getHistory() {
    return [...this.messages];
  }

  /**
   * Очистка истории диалога
   */
  clearHistory() {
    this.messages = [];
  }

  /**
   * Получение последнего сообщения
   */
  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
}

export default {
  sendMessage,
  ChatSession
};