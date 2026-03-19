# Stage 1 — build TypeScript
# Use Debian-slim: mediasoup needs Python + pip to build its native worker,
# and Alpine's pip is broken in restricted environments.
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2 — production runtime
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Directory for local file uploads (used when R2 is not configured)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "start"]
