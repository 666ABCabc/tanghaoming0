import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Попытка импорта nodemailer для отправки email
let createTransport;
try {
  const nodemailer = await import('nodemailer');
  createTransport = nodemailer.createTransport || nodemailer.default?.createTransport;
} catch {
  console.warn('⚠️  nodemailer not installed. Email sending disabled. Run: npm install nodemailer');
  createTransport = null;
}

// Загружаем .env вручную (чтобы не добавлять зависимость dotenv; оставляем просто)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

function loadEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* .env may not exist in production */ }
}

loadEnv(envPath);

// Конфигурация
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const PORT = process.env.PORT || 3001;
const REQUEST_TIMEOUT_MS = 60_000; // 60 секунд
const MAX_CONTEXT_MESSAGES = 40;   // хранить последние N сообщений, отправляемых модели

if (!DEEPSEEK_API_KEY) {
  console.error('❌  DEEPSEEK_API_KEY is not set. Create a .env file in the project root.');
  process.exit(1);
}

// Express приложение
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Алиасы .php — для локальной разработки, соответствие продакшн URL
app.use((req, _res, next) => {
  req.url = req.url.replace(/\.php($|\?)/, '$1');
  next();
});

// POST /api/chat
// Тело запроса: { messages: [{role,content},...], model?, temperature?, maxTokens? 
app.post('/api/chat', async (req, res) => {
  try {
    let { messages, model, temperature, maxTokens } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // ---- обрезаем контекст до MAX_CONTEXT_MESSAGES (сохраняем системные промпты, если есть) --
    if (messages.length > MAX_CONTEXT_MESSAGES) {
      const systemMsgs = messages.filter(m => m.role === 'system');
      const nonSystem  = messages.filter(m => m.role !== 'system');
      messages = [
        ...systemMsgs,
        ...nonSystem.slice(-MAX_CONTEXT_MESSAGES)
      ];
    }

    // ---- вызываем DeepSeek с таймаутом через AbortController ------------------
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const apiRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

   // ---- передаём статус и тело ответа ------------------------------------------
    const body = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        error: body.error?.message || `DeepSeek API error: ${apiRes.status}`,
        status: apiRes.status,
        retryAfter: apiRes.headers.get('retry-after') || null
      });
    }

    return res.json(body);

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'DeepSeek API request timed out' });
    }
    console.error('Proxy error:', err);
    return res.status(502).json({ error: 'Failed to reach DeepSeek API' });
  }
});

// ===================== Contact Form Agent API =====================

// Загрузка конфигурации контактной формы
function loadContactConfig() {
  const configPath = resolve(__dirname, 'contact-config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

// GET /api/contact-config — возвращает слоты и приветствие на фронтенд
app.get('/api/contact-config', (_req, res) => {
  try {
    const config = loadContactConfig();
    res.json({
      slots: config.slots,
      greeting: config.greeting,
      completionMessage: config.completionMessage
    });
  } catch (err) {
    console.error('Failed to load contact config:', err);
    res.status(500).json({ error: 'Failed to load contact configuration' });
  }
});

// POST /api/contact-submit — сохраняет собранные данные + отправляет email
app.post('/api/contact-submit', async (req, res) => {
  try {
    const { collectedData } = req.body;
    if (!collectedData || typeof collectedData !== 'object') {
      return res.status(400).json({ error: 'collectedData object is required' });
    }

    const config = loadContactConfig();

    // 1. Сохранение в JSON файл
    const storagePath = resolve(__dirname, '..', config.dataStoragePath || 'server/contact-data');
    if (!existsSync(storagePath)) {
      mkdirSync(storagePath, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `contact-${timestamp}.json`;
    const record = {
      timestamp: new Date().toISOString(),
      data: collectedData
    };
    writeFileSync(join(storagePath, filename), JSON.stringify(record, null, 2), 'utf-8');
    console.log(`✅  Contact data saved to ${filename}`);

    // 2. Отправка email
    let emailSent = false;
    const smtp = config.smtp || {};
    const smtpUser = smtp.authUser || process.env.SMTP_USER || '';
    const smtpPass = smtp.authPass || process.env.SMTP_PASS || '';

    if (smtpUser && smtpPass && createTransport) {
      try {
        const transporter = createTransport({
          host: smtp.host || 'smtp.qq.com',
          port: smtp.port || 465,
          secure: smtp.secure !== false,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        // Построение тела письма
        let htmlBody = '<h2>New Customer Contact Info</h2><table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">';
        for (const slot of config.slots) {
          const val = collectedData[slot.key] || '(not provided)';
          htmlBody += `<tr><td style="background:#f0f0f0;font-weight:bold;">${slot.label}</td><td>${val}</td></tr>`;
        }
        htmlBody += '</table>';
        htmlBody += `<p style="color:#888;margin-top:16px;">Submitted at: ${record.timestamp}</p>`;

        await transporter.sendMail({
          from: `"智能客服" <${smtpUser}>`,
          to: config.targetEmail,
          subject: config.emailSubject || '新客户联系信息',
          html: htmlBody
        });

        emailSent = true;
        console.log(`✅  Email sent to ${config.targetEmail}`);
      } catch (emailErr) {
        console.error('❌  Email sending failed:', emailErr.message);
      }
    } else {
      console.warn('⚠️  SMTP credentials not configured. Email not sent. Data saved to file only.');
    }

    res.json({
      success: true,
      saved: true,
      emailSent,
      message: emailSent
        ? '数据已保存并通过邮件发送'
        : '数据已保存（邮件未配置，仅保存到文件）'
    });

  } catch (err) {
    console.error('Contact submit error:', err);
    res.status(500).json({ error: 'Failed to process contact submission' });
  }
});

// Проверка здоровья
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅  Backend proxy running on http://localhost:${PORT}`);
});