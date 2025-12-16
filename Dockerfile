# Файл: ./Dockerfile

# 1. Сборка (Builder stage)
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем TypeScript в JavaScript (папка dist)
RUN npm run build

# 2. Запуск (Production stage)
FROM node:20-alpine

WORKDIR /app

# Копируем собранный проект и зависимости из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Создаем папку для локальных загрузок, если она нужна (на всякий случай)
RUN mkdir -p uploads

# Открываем порт
EXPOSE 5000

# Запускаем приложение
CMD ["npm", "start"]