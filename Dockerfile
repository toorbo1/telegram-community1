FROM node:18-alpine

WORKDIR /app

# Устанавливаем системные зависимости для sqlite3
RUN apk add --no-cache python3 make g++

# Копируем package.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production --legacy-peer-deps

# Копируем исходный код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "server.js"]