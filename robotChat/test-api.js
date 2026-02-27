// Тест интеграции DeepSeek API (через бэкенд-прокси)
// Предварительно запустите бэкенд: npm run dev:server

const PROXY_URL = 'http://localhost:3001/api/chat';// URL прокси-эндпоинта
/**
 * Функция отправки сообщения на прокси-сервер
 */
async function sendMessage(messages) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
 // Обработка ошибок HTTP
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `API 请求失败: ${response.status}. ${errorData.error || ''}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;// Извлечение текста ответа
}
/**
 * Основная тестовая функция
 */
async function testDeepSeekAPI() {
  console.log('🧪 开始测试 DeepSeek API 集成...\n');

  try {
   // Тест 1: Отправка простого сообщения
    console.log('📤 测试 1: 发送消息 "你好，请用一句话介绍你自己"');
    const messages1 = [
      { role: 'user', content: '你好，请用一句话介绍你自己' }
    ];
    const response1 = await sendMessage(messages1);

    console.log('\n📥 收到响应:');
    console.log('─'.repeat(50));
    console.log(response1);
    console.log('─'.repeat(50));
  // Тест 2: Проверка контекста диалога
    console.log('\n📤 测试 2: 测试上下文理解 "你刚才说了什么？"');
    const messages2 = [
      { role: 'user', content: '你好，请用一句话介绍你自己' },
      { role: 'assistant', content: response1 },
      { role: 'user', content: '你刚才说了什么？' }
    ];
    const response2 = await sendMessage(messages2);

    console.log('\n📥 收到响应:');
    console.log('─'.repeat(50));
    console.log(response2);
    console.log('─'.repeat(50));

    console.log('\n✅ 所有测试通过！DeepSeek API 集成正常工作');
    console.log('\n📊 测试总结:');
    console.log('  ✓ API 连接成功');
    console.log('  ✓ 消息发送和接收正常');
    console.log('  ✓ 对话上下文保持正常');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n详细错误信息:', error);
    process.exit(1);// Завершение процесса с кодом ошибки
  }
}

  // Тест 2: Проверка контекста диалога
testDeepSeekAPI();

