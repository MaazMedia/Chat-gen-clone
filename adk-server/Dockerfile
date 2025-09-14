# ADK Server Dockerfile
FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY adk-server/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY adk-server/src ./src
COPY adk-server/tsconfig.json ./
COPY adk-server/adk.config.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 adk

# Copy built application
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/adk.config.json ./
COPY --from=base /app/package.json ./

USER adk

EXPOSE 8080

ENV NODE_ENV=production
ENV ADK_PORT=8080
ENV ADK_HOST=0.0.0.0

CMD ["npm", "start"]