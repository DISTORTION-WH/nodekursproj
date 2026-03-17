# Stage 1 — build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2 — production runtime (lean image, no dev deps)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Directory for local file uploads (used when R2 is not configured)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
