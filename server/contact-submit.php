<?php
// ---------------------------------------------------------------------------
// POST /api/contact-submit
// Принимает контактные данные с фронтенда, сохраняет в файл + отправляет email
// Расположение: /var/www/tanghaoming.gulden.tv/html/api/contact-submit.php
// ---------------------------------------------------------------------------

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Предварительные запросы OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Только POST запросы
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// ---- Чтение тела запроса ---------------------------------------------------
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['collectedData']) || !is_array($input['collectedData'])) {
    http_response_code(400);
    echo json_encode(['error' => 'collectedData object is required']);
    exit;
}

$collectedData = $input['collectedData'];

// ---- Чтение конфигурационного файла -----------------------------------------
$configPath = __DIR__ . '/contact-config.json';

if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'contact-config.json not found']);
    exit;
}

$config = json_decode(file_get_contents($configPath), true);

if (!$config) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to parse contact-config.json']);
    exit;
}

// ---- 1. Сохранение в JSON файл ----------------------------------------------
$saved = false;
$dataDir = __DIR__ . '/contact-data';

// Создание директории если не существует
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$timestamp  = date('c');                                      // ISO 8601 формат времени
$safeTime   = str_replace([':', '.'], '-', $timestamp);
$filename   = 'contact-' . $safeTime . '.json';
$record     = [
    'timestamp' => $timestamp,
    'data'      => $collectedData,
];

$saved = file_put_contents(
    $dataDir . '/' . $filename,
    json_encode($record, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
) !== false;

if ($saved) {
    error_log("Contact data saved: $filename");
}

// ---- 2. Отправка email ------------------------------------------------------
$emailSent   = false;
$smtp        = $config['smtp'] ?? [];
$smtpUser    = !empty($smtp['authUser']) ? $smtp['authUser'] : getenv('SMTP_USER');
$smtpPass    = !empty($smtp['authPass']) ? $smtp['authPass'] : getenv('SMTP_PASS');
$recipient   = $config['targetEmail']   ?? '';
$subject     = $config['emailSubject']  ?? 'New Customer Contact Info';
$slots       = $config['slots']         ?? [];

if ($smtpUser && $smtpPass && $recipient) {
    // Построение тела письма
    $htmlRows = '';
    foreach ($slots as $slot) {
        $val       = $collectedData[$slot['key']] ?? '(not provided)';
        $label     = htmlspecialchars($slot['label']);
        $valEsc    = htmlspecialchars($val);
        $htmlRows .= "<tr><td style=\"background:#f0f0f0;font-weight:bold;padding:8px;border:1px solid #ddd;\">$label</td>"
                   . "<td style=\"padding:8px;border:1px solid #ddd;\">$valEsc</td></tr>";
    }
    $timeStr  = date('Y-m-d H:i:s');
    $htmlBody = "
<h2 style=\"color:#333;\">New Customer Contact Info</h2>
<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;\">
$htmlRows
</table>
<p style=\"color:#888;margin-top:16px;\">Submitted at: $timeStr</p>";

    $emailSent = sendSmtp(
        $smtp['host']   ?? 'smtp.qq.com',
        (int)($smtp['port'] ?? 465),
        (bool)($smtp['secure'] ?? true),
        $smtpUser,
        $smtpPass,
        $smtpUser,
        $recipient,
        $subject,
        $htmlBody
    );

    if (!$emailSent) {
        error_log("Email sending failed to $recipient");
    }
} else {
    error_log('SMTP credentials not configured. Email skipped.');
}

// ---- Возврат результата ----------------------------------------------------
echo json_encode([
    'success'   => $saved,
    'saved'     => $saved,
    'emailSent' => $emailSent,
    'message'   => $emailSent
        ? 'Data saved and email sent successfully'
        : 'Data saved (email not configured or sending failed)',
]);

// ===========================================================================
// Функция отправки SMTP (без внешних библиотек, использует PHP fsockopen)
// ===========================================================================
function sendSmtp(
    string $host,
    int    $port,
    bool   $secure,
    string $user,
    string $pass,
    string $from,
    string $to,
    string $subject,
    string $htmlBody
): bool {
    try {
        // Установка соединения
        if ($secure) {
            $socket = fsockopen("ssl://$host", $port, $errno, $errstr, 15);
        } else {
            $socket = fsockopen($host, $port, $errno, $errstr, 15);
        }

        if (!$socket) {
            error_log("SMTP connect failed: $errstr ($errno)");
            return false;
        }

        // Установка таймаута чтения/записи
        stream_set_timeout($socket, 15);

        // Вспомогательная функция: отправка команды и чтение ответа
        $send = function (string $cmd) use ($socket): string {
            fwrite($socket, $cmd . "\r\n");
            $line = fgets($socket, 512);
            $info = stream_get_meta_data($socket);
            if ($info['timed_out']) {
                error_log("SMTP read timed out after command: $cmd");
                return '';
            }
            return $line ?: '';
        };

        // Чтение приветствия сервера
        fgets($socket, 512);

        // EHLO
        $send("EHLO " . gethostname());
        // Чтение многострочного ответа
        while (($line = fgets($socket, 512)) !== false) {
            $info = stream_get_meta_data($socket);
            if ($info['timed_out']) break;
            if (substr($line, 3, 1) === ' ') break;
        }

        // AUTH LOGIN
        $send("AUTH LOGIN");                        // → сервер: 334 Username:
        $send(base64_encode($user));                // → сервер: 334 Password:
        $authResp = $send(base64_encode($pass));    // → сервер: 235 Authentication successful

        if (substr($authResp, 0, 3) !== '235') {
            error_log("SMTP AUTH failed: $authResp");
            fclose($socket);
            return false;
        }

        // MAIL FROM
        $send("MAIL FROM:<$from>");                 // → сервер: 250 OK

        // RCPT TO
        $send("RCPT TO:<$to>");                     // → сервер: 250 OK

        // DATA
        $send("DATA");                              // → сервер: 354 Start mail input

        // Заголовки и тело письма
        $boundary = md5(uniqid());
        $headers  = "From: \"Smart Contact Form\" <$from>\r\n"
                  . "To: $to\r\n"
                  . "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n"
                  . "MIME-Version: 1.0\r\n"
                  . "Content-Type: text/html; charset=UTF-8\r\n"
                  . "Date: " . date('r') . "\r\n";

        fwrite($socket, $headers . "\r\n" . $htmlBody . "\r\n.\r\n");
        $dataResp = fgets($socket, 512);

        $send("QUIT");
        fclose($socket);

        return substr($dataResp, 0, 3) === '250';

    } catch (\Throwable $e) {
        error_log("SMTP exception: " . $e->getMessage());
        return false;
    }
}