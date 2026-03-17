# Stage 1 — build TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# mediasoup needs Python + build tools to compile its native worker
RUN apk add --no-cache python3 make g++ linux-headers

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2 — production runtime (lean image, no dev deps)
FROM node:22-alpine

# mediasoup worker binary needs Python at runtime too (postinstall on prod install)
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Directory for local file uploads (used when R2 is not configured)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
