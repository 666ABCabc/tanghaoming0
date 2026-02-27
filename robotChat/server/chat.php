<?php
// ---- Заголовки CORS ------------------------------------------------------
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Предварительные запросы OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Разрешаем только POST ------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// ---- Получение API ключа (из переменных окружения или .env) ---------------
$apiKey = getenv('DEEPSEEK_API_KEY');

if (!$apiKey) {
    // Пробуем прочитать из .env файла в корне проекта
    $envFile = dirname(__DIR__) . '/.env';
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2 && trim($parts[0]) === 'DEEPSEEK_API_KEY') {
                $apiKey = trim($parts[1]);
                break;
            }
        }
    }
}

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'DEEPSEEK_API_KEY is not configured on the server']);
    exit;
}

// ---- Парсинг тела запроса -------------------------------------------------
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['messages']) || !is_array($input['messages']) || count($input['messages']) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'messages array is required']);
    exit;
}

$messages    = $input['messages'];
$model       = $input['model']       ?? 'deepseek-chat';
$temperature = $input['temperature'] ?? 0.7;
$maxTokens   = $input['maxTokens']   ?? 2000;

// ---- Обрезка контекста (последние 40 сообщений) ---------------------------
$maxContext = 40;
if (count($messages) > $maxContext) {
    $systemMsgs = array_values(array_filter($messages, fn($m) => $m['role'] === 'system'));
    $nonSystem  = array_values(array_filter($messages, fn($m) => $m['role'] !== 'system'));
    $nonSystem  = array_slice($nonSystem, -$maxContext);
    $messages   = array_merge($systemMsgs, $nonSystem);
}

// ---- Вызов DeepSeek API ---------------------------------------------------
$requestBody = json_encode([
    'model'       => $model,
    'messages'    => $messages,
    'temperature' => (float) $temperature,
    'max_tokens'  => (int) $maxTokens,
]);

$ch = curl_init('https://api.deepseek.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $requestBody,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
]);

$response   = curl_exec($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

// ---- Обработка ошибок -----------------------------------------------------
if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach DeepSeek API: ' . $curlError]);
    exit;
}

http_response_code($httpCode);
echo $response;