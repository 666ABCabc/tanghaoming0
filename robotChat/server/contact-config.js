// server/contact-config.js
// Конфигурация интеллектуальной контактной формы - все настройки можно изменить здесь

export default {
    // Поля для сбора (запрашиваются по порядку)
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
            validate: (value) => /^1[3-9]\d{9}$/.test(value) ? null : 'Please enter a valid 11-digit phone number'
        },
        { 
            name: 'email', 
            label: 'Email',
            prompt: 'Finally, please provide your email address. We will send you the details.',
            validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address'
        }
    ],

    // Email для получения отправленных данных
    recipient_email: '1472713854@qq.com',

    // Конфигурация отправки email (используется QQ Mail)
    email_config: {
        host: 'smtp.qq.com',
        port: 587,
        secure: false,
        auth: {
            user: '1472713854@qq.com',
            pass: 'ffzojqssuzxahbgg'
        }
    },

    // Сообщения бота
    bot_messages: {
        welcome: "Hello! I'm your intelligent assistant. To better serve you, I need to collect some basic information first.",
        thank_you: "Thank you for your cooperation! Your information has been successfully submitted. Our customer service will contact you soon.",
        error: "Sorry, we encountered a technical issue. Please try again later.",
        invalid_input: "Invalid input format. Please try again."
    },

    // Настройки хранения данных
    storage: {
        save_to_file: true,      // Сохранять в файл
        file_path: './submissions.json',  // Путь к файлу
        send_email: true          // Отправлять email
    }
};