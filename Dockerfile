# syntax=docker/dockerfile:1

FROM node:25-bookworm AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY client/package*.json ./client/
RUN npm --prefix client install

COPY . .
RUN npm run build

FROM node:25-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/server/src/index.js"]
