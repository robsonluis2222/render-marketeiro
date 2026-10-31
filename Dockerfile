FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libgbm1 \
    libasound2 \
    libxrandr2 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libx11-xcb1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src ./src
COPY public ./public
COPY server.mjs ./

RUN mkdir -p storage/assets public/generated

RUN npx remotion browser ensure

ENV NODE_ENV=production

EXPOSE 8787

CMD ["node", "server.mjs"]
