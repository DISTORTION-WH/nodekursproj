# Деплой Lume Chat — бесплатно

Стек деплоя:
| Сервис | Что деплоим | Бесплатный тир |
|--------|------------|---------------|
| [Railway](https://railway.app) | Backend API + PostgreSQL | 500 часов/месяц ($5 credit) |
| [Vercel](https://vercel.com) | Frontend (React) | Unlimited для хобби-проектов |
| [Cloudflare R2](https://dash.cloudflare.com) | Файлы (аватары, медиа) | 10 GB / 10M запросов бесплатно |
| [EmailJS](https://emailjs.com) | Email-верификация | 200 писем/месяц бесплатно |

---

## 1. Подготовка репозитория

```bash
# Убедитесь что .env НЕ в git
git status   # .env не должен фигурировать
```

Скопируйте шаблон и заполните:
```bash
cp .env.example .env
# Отредактируйте .env — заполните все значения
```

---

## 2. Cloudflare R2 (файловое хранилище)

1. Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com)
2. **R2 Object Storage → Create bucket** — назовите `lume-uploads`
3. **Settings → Public access** — включите (чтобы аватары были доступны по URL)
4. **Manage R2 API tokens → Create API token** — дайте права `Object Read & Write`
5. Скопируйте в `.env`:
   ```
   MINIO_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   MINIO_ACCESS_KEY=<Access Key ID>
   MINIO_SECRET_KEY=<Secret Access Key>
   MINIO_BUCKET_NAME=lume-uploads
   MINIO_PUBLIC_URL=https://pub-<hash>.r2.dev
   ```

---

## 3. EmailJS (отправка кодов регистрации)

1. Зарегистрируйтесь на [emailjs.com](https://emailjs.com)
2. **Email Services → Add New Service** — подключите Gmail или SMTP
3. **Email Templates → Create New Template** — создайте шаблон с переменной `{{code}}`
4. **Account → API Keys** — скопируйте Public Key
5. Заполните в `.env`:
   ```
   EMAILJS_SERVICE_ID=service_xxxxxxx
   EMAILJS_TEMPLATE_ID=template_xxxxxxx
   EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxx
   EMAILJS_PRIVATE_KEY=xxxxxxxxxxxxxx
   ```

---

## 4. Railway — деплой Backend + Database

### 4.1 Создание проекта

1. Зайдите на [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → выберите ваш репозиторий

### 4.2 PostgreSQL

1. В проекте: **+ New → Database → PostgreSQL**
2. Railway создаст БД и автоматически добавит переменную `DATABASE_URL`
3. Нажмите на сервис PostgreSQL → **Connect** → скопируйте `DATABASE_URL`

### 4.3 Настройка API-сервиса

1. В проекте нажмите на GitHub-сервис (backend)
2. **Settings → Build**:
   - Root Directory: `apps/api` ← **обязательно**, иначе Railway запустит turbo из корня и упадёт
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
3. **Variables** — добавьте все переменные:

```
NODE_ENV=production
DATABASE_URL=<скопировано из шага 4.2>
JWT_SECRET=<сгенерируйте: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
FRONTEND_URL=https://<ваш-проект>.vercel.app
CLIENT_URL=https://<ваш-проект>.vercel.app
MINIO_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
MINIO_ACCESS_KEY=<ключ>
MINIO_SECRET_KEY=<секрет>
MINIO_BUCKET_NAME=lume-uploads
MINIO_PUBLIC_URL=https://pub-<hash>.r2.dev
EMAILJS_SERVICE_ID=<id>
EMAILJS_TEMPLATE_ID=<id>
EMAILJS_PUBLIC_KEY=<ключ>
EMAILJS_PRIVATE_KEY=<ключ>
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<публичный IP Railway — смотри Settings → Networking>
PORT=5000
```

4. **Settings → Networking → Generate Domain** — получите URL вида `https://lume-api-production.up.railway.app`
5. Запишите этот URL — он понадобится для фронтенда

### 4.4 Проверка деплоя API

```bash
curl https://lume-api-production.up.railway.app/health
# Должен вернуть 200 OK (или проверьте логи в Railway)
```

---

## 5. Vercel — деплой Frontend

### 5.1 Подключение репозитория

1. Зайдите на [vercel.com](https://vercel.com) → **New Project**
2. Импортируйте ваш GitHub-репозиторий
3. **Configure Project**:
   - Framework Preset: **Create React App**
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `build`

### 5.2 Environment Variables

В **Environment Variables** добавьте:
```
REACT_APP_API_URL=https://lume-api-production.up.railway.app
```
> Это URL вашего Railway-сервиса из шага 4.4

### 5.3 Deploy

Нажмите **Deploy**. Vercel соберёт React-приложение с вашим API URL внутри бандла.

После деплоя запишите URL вида `https://lume-chat.vercel.app`.

---

## 6. Финальная настройка CORS

Вернитесь в Railway → Variables вашего API-сервиса и обновите:
```
FRONTEND_URL=https://lume-chat.vercel.app
CLIENT_URL=https://lume-chat.vercel.app
```

Railway автоматически передеплоит сервис.

---

## 7. Проверка

- Откройте `https://lume-chat.vercel.app`
- Зарегистрируйтесь (нужен код — проверьте почту)
- Войдите, создайте чат, отправьте сообщение
- Убедитесь что файлы загружаются (аватар)

---

## 8. Локальный запуск через Docker (альтернатива)

```bash
# Скопируйте .env
cp .env.example .env
# Отредактируйте .env

# Запуск всего стека
docker-compose up --build

# Frontend:  http://localhost:3000
# Backend:   http://localhost:5000
# Database:  localhost:5432
```

Для кастомного API URL при сборке Docker:
```bash
REACT_APP_API_URL=http://your-server:5000 docker-compose up --build
```

---

## 9. Переменные окружения — сводная таблица

| Переменная | Где задать | Обязательна |
|-----------|-----------|------------|
| `DATABASE_URL` | Railway (авто) | Да (prod) |
| `DB_HOST/PORT/USER/PASSWORD/DATABASE` | .env / docker-compose | Да (local) |
| `JWT_SECRET` | Railway + .env | Да |
| `FRONTEND_URL` | Railway | Да (prod) |
| `CLIENT_URL` | docker-compose / Railway | Да |
| `REACT_APP_API_URL` | Vercel + .env | Да |
| `MINIO_*` (5 шт.) | Railway + .env | Да (для загрузки файлов) |
| `EMAILJS_*` (4 шт.) | Railway + .env | Да (для регистрации) |
| `MEDIASOUP_LISTEN_IP` | Railway + .env | Да (для звонков) |
| `MEDIASOUP_ANNOUNCED_IP` | Railway + .env | Да (для звонков) |
| `PORT` | Railway (авто=5000) | Нет |

---

## Заметки

- **Mediasoup (групповые звонки)** требует UDP-порты. Railway поддерживает TCP, но UDP может не работать на бесплатном тире. Для звонков в продакшне рассмотрите [Fly.io](https://fly.io) или VPS (Hetzner от €4/мес).
- **WebRTC (P2P звонки)** работают через STUN/TURN серверы — они уже настроены в `CallContext.tsx` и не требуют дополнительной настройки.
- **Refresh tokens** хранятся в `localStorage` — нормально для SPA, но для production можно перейти на HttpOnly cookies.
