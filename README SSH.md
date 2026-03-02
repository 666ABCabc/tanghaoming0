Группа 1: Первое подключение
bash
# Подключение к серверу
ssh tanghaoming@shirley.gulden.tv

# Просмотр текущей директории
pwd

# Просмотр содержимого домашней директории
ls

# Переход в директорию site (символическая ссылка)
cd site

# Просмотр содержимого site
ls




Группа 2: Очистка старых файлов
bash
# Просмотр домашней директории
ls

# Переход в site
cd site

# Просмотр содержимого site
ls

# Удаление старых файлов (assets, index.html, favicon.ico, api)
rm -rf ~/site/assets ~/site/index.html ~/site/favicon.ico ~/site/api

# Проверка после удаления
ls

# Удаление всех index-* JS и CSS файлов
rm -f ~/site/index-*.js ~/site/index-*.css

# Проверка после удаления (должно быть пусто)
ls

# Создание директории для хранения данных API
mkdir -p ~/site/api/contact-data

# Установка прав доступа 755 (владелец: чт/зп/исп, остальные: чт/исп)
chmod 755 ~/site/api/contact-data

# Просмотр содержимого site (должна быть только папка api)
ls ~/site

# Просмотр текущей директории
ls




Группа 3: Проверка после загрузки
bash
# Просмотр домашней директории
ls

# Переход в site
cd site

# Просмотр содержимого site
ls

# Проверка локального сервера (только HTTP статус)
curl -s -o /dev/null -w "%{http_code}" http://localhost

# Проверка доступности сайта (только HTTP статус)
curl -s -o /dev/null -w "%{http_code}" http://tanghaoming.gulden.tv

# Просмотр содержимого site
ls

# Ошибочная попытка посмотреть assets (неправильный путь)
ls ~/assets

# Переход в директорию assets
cd assets

# Просмотр содержимого assets
ls




Группа 4: Настройка прав и проверка SMTP
bash
# Подключение к серверу
ssh tanghaoming@shirley.gulden.tv

# Проверка SMTP подключения (QQ邮箱 порт 465)
nc -zv smtp.qq.com 465

# Просмотр домашней директории
ls

# Установка прав 755 на директорию с данными
chmod 755 ~/site/api/contact-data

# Детальный просмотр содержимого API директории
ls -la ~/site/api/

# Просмотр информации о файле contact-submit.php
ls -la ~/site/api/contact-submit.php




Группа 5: Настройка ACL прав
bash
# Временная установка прав 777 для тестирования
chmod 777 ~/site/api/contact-data

# PHP тест записи в файл
php -r "var_dump(file_put_contents('/home/tanghaoming/site/api/contact-data/test.txt', 'hello'));"

# Просмотр домашней директории
ls

# Просмотр ACL прав на директорию
getfacl ~/site/api/contact-data

# Просмотр процессов Apache
ps aux | grep -E 'apache|www-data|php-fpm' | grep -v grep | head -3

# Добавление прав для пользователя www-data
setfacl -m u:www-data:rwx ~/site/api/contact-data

# Установка прав по умолчанию для новых файлов
setfacl -m d:u:www-data:rwx ~/site/api/contact-data

# Проверка прав www-data
getfacl ~/site/api/contact-data | grep www-data





SFTP команды (все подключения)
SFTP подключение 1
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение локальной директории на корень проекта
lcd C:\Users\tanghaoming\Desktop\robotChat

# Загрузка всей папки dist на сервер
put -r dist /home/tanghaoming/site




SFTP подключение 2
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение на локальную директорию проекта
lcd C:\Users\tanghaoming\Desktop\robotChat

# Загрузка dist
put -r dist /home/tanghaoming/site

# Загрузка PHP файлов в API директорию
put server/chat.php /home/tanghaoming/site/api/chat.php
put server/contact-config.php /home/tanghaoming/site/api/contact-config.php
put server/contact-submit.php /home/tanghaoming/site/api/contact-submit.php
put server/contact-config.json /home/tanghaoming/site/api/contact-config.json

# Загрузка .env в домашнюю директорию
put .env /home/tanghaoming/.env

# Попытка загрузки .htaccess (обрыв)
put .htaccess /home/tanghaoming/site/.htaccess
# client_loop: send disconnect: Connection reset




SFTP подключение 3
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение на локальную директорию проекта
lcd C:\Users\tanghaoming\Desktop\robotChat

# Переключение на локальную папку public
lcd C:\Users\tanghaoming\Desktop\robotChat\public

# Загрузка .htaccess в site
put .htaccess /home/tanghaoming/site/.htaccess





SFTP подключение 4
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение на локальную папку server
lcd C:\Users\tanghaoming\Desktop\robotChat\server

# Загрузка contact-config.json
put contact-config.json /home/tanghaoming/site/api/contact-config.json



SFTP подключение 5
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение на локальную директорию проекта
lcd C:\Users\tanghaoming\Desktop\robotChat

# Загрузка contact-submit.php
put server/contact-submit.php /home/tanghaoming/site/api/contact-submit.php




SFTP подключение 6
bash
# Подключение по SFTP
sftp tanghaoming@shirley.gulden.tv

# Переключение на локальную директорию проекта
lcd C:\Users\tanghaoming\Desktop\robotChat

# Загрузка contact-config.json
put server/contact-config.json /home/tanghaoming/site/api/contact-config.json






Цели развертывания сайта

1. Обеспечить публичный доступ к сайту
bash
# Локальная разработка - доступ только у вас
http://localhost:5173/contact  # Только вы можете видеть

# После развертывания - доступ для всего мира
https://tanghaoming.gulden.tv/contact  # Любой может зайти
Разница:


2. Круглосуточная работа без перерывов
# До развертывания - только тестовые данные
submissions.json  # Ваши тестовые записи

# После развертывания - реальные пользователи
site/api/contact-data/contact-2026-02-27T08-21-28-880Z.json
site/api/contact-data/contact-2026-02-27T08-47-26-066Z.json
site/api/contact-data/contact-2026-02-27T08-59-30-601Z.json
# Здесь сохраняются настоящие имена, телефоны и email посетителей
Пример реальных данных:

json
{
  "name": "",
  "phone": "",
  "email": "",
  "submitted_at": ""
}
4. Автоматическая отправка email уведомлений
bash
# При каждой отправке формы
# Автоматически отправляется письмо на указанный email

# Проверка SMTP подключения
nc -zv smtp.qq.com 465
# Connection to smtp.qq.com 465 port succeeded!

# Письмо содержит все данные пользователя

