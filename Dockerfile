FROM node:20-bookworm-slim AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
EXPOSE 3001
CMD ["npm", "run", "start"]
