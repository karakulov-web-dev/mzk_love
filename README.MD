# приложение vk_mzk;

Зависит от:
http://212.77.128.177:8081/getSpeech - синтез речи
https://api.vk.com/ - vk api

Запуск: node index.js

Структура каталогов:
client - клиентская часть (скрипты для stalker portal)
docs - подобие документации
getToken - phantomjs bot парсит access token для работы с vk api
account.config.js - Данные для авторизации в вк для getToken.js
index.ts - точка входа typescript (исходник) backend
index.js - точка входа backend запуск : node index.js
