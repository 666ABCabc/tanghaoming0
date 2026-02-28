<?php
// ---------------------------------------------------------------------------
// GET /api/contact-config
// Читает contact-config.json, возвращает слоты/приветствие/сообщение для фронтенда
// Расположение: /var/www/tanghaoming.gulden.tv/html/api/contact-config.php
// ---------------------------------------------------------------------------

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Предварительные запросы OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Только GET запросы
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// contact-config.json находится в той же директории (api/)
$configPath = __DIR__ . '/contact-config.json';

// Проверка существования файла
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'contact-config.json not found']);
    exit;
}

// Чтение и парсинг JSON
$config = json_decode(file_get_contents($configPath), true);

// Проверка корректности JSON
if (!$config) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to parse contact-config.json']);
    exit;
}

// Возврат конфигурации фронтенду
echo json_encode([
    'slots'             => $config['slots']             ?? [],
    'greeting'          => $config['greeting']          ?? 'Hello! Please provide your contact information.',
    'completionMessage' => $config['completionMessage'] ?? 'Thank you for your information!',
]);