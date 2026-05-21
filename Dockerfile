FROM node:20-bookworm-slim AS deps
WORKDIR /backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /backend
COPY --from=deps /backend/node_modules ./node_modules
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /backend
COPY --from=build /backend/package.json ./package.json
COPY --from=build /backend/node_modules ./node_modules
COPY --from=build /backend/dist ./dist
EXPOSE 3001
CMD ["npm", "run", "start"]
