// server/contact-bot.js
// Node.js версия с DeepSeek API, использующая нативный fetch

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Хранилище сессий в памяти
const sessions = new Map();

// Очистка устаревших сессий (1 час)
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.created > 3600000) {
            sessions.delete(sessionId);
        }
    }
}, 60000);

// Конфигурация
const CONFIG = {
    required_fields: [
        { 
            name: 'name', 
            label: 'Name', 
            prompt: 'What should I call you?',
            validate: (value) => value.length >= 2 ? null : 'Name must be at least 2 characters'
        },
        { 
            name: 'phone', 
            label: 'Phone', 
            prompt: 'Please leave your phone number so we can contact you.',
            validate: (value) => /^[0-9+\-\s]{10,15}$/.test(value) ? null : 'Please enter a valid phone number'
        },
        { 
            name: 'email', 
            label: 'Email', 
            prompt: 'Finally, please provide your email address.',
            validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address'
        }
    ],
    recipient_email: '1472713854@qq.com',
    bot_messages: {
        welcome: 'Hello! I am your intelligent assistant. To better serve you, I need to collect some basic information.',
        thank_you: 'Thank you for your cooperation! Your information has been successfully submitted.',
        error: 'Sorry, we encountered a technical issue. Please try again later.'
    },
    storage: {
        save_to_file: true,
        file_path: path.join(__dirname, '../submissions.json'),
        send_email: true
    }
};

// Вызов DeepSeek API через нативный fetch
async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('DEEPSEEK_API_KEY not found');
            return null;
        }

        console.log('Calling DeepSeek API...');

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.7,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with ${response.status}`);
        }

        const data = await response.json();
        if (data.choices && data.choices[0]) {
            const reply = data.choices[0].message.content;
            console.log('DeepSeek API response:', reply);
            return reply;
        }
        return null;
    } catch (error) {
        console.error('DeepSeek API error:', error.message);
        return null;
    }
}

// Сохранение в файл
async function saveToFile(data) {
    try {
        let submissions = [];
        try {
            const content = await fs.readFile(CONFIG.storage.file_path, 'utf-8');
            submissions = JSON.parse(content);
        } catch (err) {
            console.log('Creating new file:', CONFIG.storage.file_path);
        }
        
        submissions.push({
            ...data,
            submitted_at: new Date().toISOString()
        });
        
        await fs.writeFile(CONFIG.storage.file_path, JSON.stringify(submissions, null, 2));
        console.log('✅ Data saved to file:', CONFIG.storage.file_path);
        return true;
    } catch (error) {
        console.error('❌ Failed to save to file:', error);
        return false;
    }
}

// Отправка email
async function sendEmail(data) {
    if (!CONFIG.storage.send_email) return true;
    
    try {
        console.log('\n========== EMAIL SENDING DEBUG ==========');
        console.log('Sending email to:', CONFIG.recipient_email);
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.qq.com',
            port: 587,
            secure: false,
            auth: {
                user: '1472713854@qq.com',
                pass: 'ffzojqssuzxahbgg'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        await transporter.verify();
        console.log('✅ SMTP connection successful');
        
        const emailContent = `
New Contact Form Submission:

========================================

Name: ${data.name || 'Not provided'}
Phone: ${data.phone || 'Not provided'}
Email: ${data.email || 'Not provided'}

Submission Time: ${new Date().toLocaleString('zh-CN')}
IP Address: ${data.ip || 'Unknown'}

========================================
        `;
        
        const info = await transporter.sendMail({
            from: '"Contact Form" <1472713854@qq.com>',
            to: CONFIG.recipient_email,
            subject: 'New Customer Inquiry - ' + new Date().toLocaleString('zh-CN'),
            text: emailContent
        });
        
        console.log('✅ Email sent successfully!');
        console.log('Email ID:', info.messageId);
        console.log('=========================================\n');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Email sending failed:', error.message);
        return false;
    }
}

// Обработка запросов
export default async function handleContactBot(req, res) {
    // Только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message, action } = req.body;
    
    // Получение IP клиента
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Генерация ID сессии
    let sessionId = req.headers['x-session-id'];
    if (!sessionId) {
        sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    console.log(`\n[Session ${sessionId}] Received request:`, { action, message });

    // Сброс сессии
    if (action === 'reset') {
        console.log(`[Session ${sessionId}] Resetting session`);
        
        // Вызов AI для приветствия
        const welcome = await callDeepSeek([
            { role: 'system', content: 'You are a professional customer service bot. Your task is to collect necessary information through friendly conversation. Ask only one question at a time, be friendly and professional.' },
            { role: 'user', content: 'Start a friendly conversation and ask for the user\'s name.' }
        ]);
        
        // Запасной вариант если AI недоступен
        const reply = welcome || (CONFIG.bot_messages.welcome + ' ' + CONFIG.required_fields[0].prompt);
        
        sessions.set(sessionId, {
            step: 0,
            collected_data: { ip },
            history: [{ role: 'assistant', content: reply }],
            created: Date.now()
        });
        
        return res.json({ 
            reply: reply,
            sessionId,
            field: CONFIG.required_fields[0].name,
            progress: {
                current: 1,
                total: CONFIG.required_fields.length
            }
        });
    }

    // Получение текущей сессии
    let session = sessions.get(sessionId);
    if (!session) {
        console.log(`[Session ${sessionId}] Creating new session`);
        
        const welcome = await callDeepSeek([
            { role: 'system', content: 'You are a professional customer service bot. Your task is to collect necessary information through friendly conversation. Ask only one question at a time, be friendly and professional.' },
            { role: 'user', content: 'Start a friendly conversation and ask for the user\'s name.' }
        ]);
        
        const reply = welcome || (CONFIG.bot_messages.welcome + ' ' + CONFIG.required_fields[0].prompt);
        
        session = {
            step: 0,
            collected_data: { ip },
            history: [{ role: 'assistant', content: reply }],
            created: Date.now()
        };
        sessions.set(sessionId, session);
        
        return res.json({ 
            reply: reply,
            sessionId,
            field: CONFIG.required_fields[0].name,
            progress: {
                current: 1,
                total: CONFIG.required_fields.length
            }
        });
    }

    const currentField = CONFIG.required_fields[session.step];
    
    // Валидация ввода
    if (currentField && currentField.validate && message) {
        const validationError = currentField.validate(message);
        if (validationError) {
            console.log(`[Session ${sessionId}] Validation failed:`, validationError);
            return res.json({
                reply: validationError + ' ' + currentField.prompt,
                sessionId,
                field: currentField.name,
                error: true,
                progress: {
                    current: session.step + 1,
                    total: CONFIG.required_fields.length
                }
            });
        }
    }

    // Сохранение ответа пользователя
    if (message && currentField) {
        console.log(`[Session ${sessionId}] Saving ${currentField.name}:`, message);
        session.collected_data[currentField.name] = message;
        session.history.push({ role: 'user', content: message });
    }

    // Проверка завершения
    if (session.step >= CONFIG.required_fields.length - 1) {
        console.log(`[Session ${sessionId}] All information collected:`, session.collected_data);
        
        // Сохранение в файл
        const saved = await saveToFile(session.collected_data);
        // Отправка email
        const emailed = await sendEmail(session.collected_data);
        
        // Вызов AI для благодарности
        const thankYou = await callDeepSeek([
            { role: 'system', content: 'You are a professional customer service bot.' },
            ...session.history,
            { role: 'user', content: 'The user has provided all information. Thank them warmly.' }
        ]);
        
        const reply = thankYou || CONFIG.bot_messages.thank_you;
        
        if (saved && emailed) {
            console.log(`[Session ${sessionId}] Processing complete, deleting session`);
            sessions.delete(sessionId);
            
            return res.json({
                reply: reply,
                finished: true,
                sessionId: null
            });
        } else {
            console.log(`[Session ${sessionId}] Processing failed`);
            return res.json({
                reply: CONFIG.bot_messages.error,
                error: true
            });
        }
    }

    // Переход к следующему полю
    session.step++;
    const nextField = CONFIG.required_fields[session.step];

    // Вызов AI для следующего вопроса
    const aiPrompt = `The user just provided their ${currentField.label}: ${message}. Now ask in a friendly way for their ${nextField.label}.`;
    const aiReply = await callDeepSeek([
        { role: 'system', content: 'You are a professional customer service bot.' },
        ...session.history,
        { role: 'user', content: aiPrompt }
    ]);

    const reply = aiReply || nextField.prompt;
    session.history.push({ role: 'assistant', content: reply });

    console.log(`[Session ${sessionId}] Moving to next step:`, {
        current_step: session.step,
        next_field: nextField.name
    });

    return res.json({
        reply: reply,
        sessionId,
        field: nextField.name,
        progress: {
            current: session.step + 1,
            total: CONFIG.required_fields.length
        }
    });
}