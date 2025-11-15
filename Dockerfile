FROM node:18-alpine

WORKDIR /app

# Копируем package.json первым для кэширования зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем остальные файлы
COPY . .

# Создаем директорию для загрузок
RUN mkdir -p uploads

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]