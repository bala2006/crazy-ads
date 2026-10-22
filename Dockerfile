# MotionForge — self-hosted motion graphics studio
FROM node:22-bookworm-slim

# Remotion drives real Chrome, which needs these shared libraries.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

# .data (settings) and public/renders (MP4s) are worth persisting:
#   docker run -p 3001:3001 -v "$PWD/.data:/app/.data" -v "$PWD/public/renders:/app/public/renders" motionforge
CMD ["npm", "start"]
