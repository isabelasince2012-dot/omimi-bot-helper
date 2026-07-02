# --- Build stage ---
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lockb* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
ENV PORT=3000
CMD ["node", ".output/server/index.mjs"]
