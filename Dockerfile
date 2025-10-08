FROM node:18-alpine

WORKDIR /app

# Устанавливаем системные зависимости
RUN apk add --no-cache python3 py3-pip make g++

# Копируем package.json
COPY package*.json ./

# Устанавливаем Node.js зависимости
RUN npm install --production --legacy-peer-deps

# Копируем requirements.txt
COPY requirements.txt .

# Создаем виртуальное окружение и устанавливаем Python зависимости
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install -r requirements.txt

# Копируем исходный код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads

# Открываем порт
EXPOSE 3000

# Устанавливаем супервизор
RUN apk add --no-cache supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Запускаем через супервизор
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]