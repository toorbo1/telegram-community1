# Telegram Community

Динамический сайт для Telegram с функциями:
- Синхронизация профиля Telegram
- Реферальные ссылки
- Добавление постов администратором
- Общие посты для всех пользователей

## Структура проекта

### Frontend (Netlify)
- `client/index.html` - главная страница
- `client/style.css` - стили
- `client/script.js` - клиентская логика

### Backend (Railway)
- `server/server.js` - Node.js сервер
- `server/package.json` - зависимости
- `server/railway.json` - конфиг Railway

## Развертывание

### Backend (Railway)
1. Создай проект на Railway
2. Подключи GitHub репозиторий
3. Railway автоматически развернет сервер

### Frontend (Netlify)
1. Залить папку `client` на Netlify
2. В `script.js` заменить `API_URL` на URL Railway
3. Получить URL для Telegram бота

## API Endpoints
- `GET /api/health` - проверка сервера
- `GET /api/posts` - получить все посты
- `POST /api/posts` - создать новый пост
- `DELETE /api/posts/:id` - удалить пост (админ)