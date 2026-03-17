# Файл: Frontend/front/Dockerfile

# 1. Сборка React
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ВАЖНО: Определяем переменную API URL для сборки
# Мы используем localhost:5000, так как браузер пользователя будет стучаться на ваш ПК снаружи докера
ENV REACT_APP_API_URL=http://localhost:5000

RUN npm run build

# 2. Запуск Nginx
FROM nginx:alpine

# Копируем сборку в папку Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Копируем наш конфиг
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]