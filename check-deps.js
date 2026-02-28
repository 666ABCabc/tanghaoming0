import { writeFileSync } from 'fs';

// Массив для сбора результатов проверки
const lines = [];

// Проверка версии Node.js
lines.push('Node: ' + process.version);

// Проверка наличия модуля express
try { await import('express'); lines.push('express: OK'); } catch(e) { lines.push('express: FAIL - ' + e.message); }

// Проверка наличия модуля nodemailer
try { await import('nodemailer'); lines.push('nodemailer: OK'); } catch(e) { lines.push('nodemailer: FAIL - ' + e.message); }

// Проверка наличия модуля cors
try { await import('cors'); lines.push('cors: OK'); } catch(e) { lines.push('cors: FAIL - ' + e.message); }

// Запись результатов в файл
writeFileSync('check-result.txt', lines.join('\n'), 'utf-8');