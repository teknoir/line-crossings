# syntax=docker/dockerfile:1
# ------------------------------------------------------------
# Multi-stage Dockerfile for line-crossings app
# ------------------------------------------------------------
# Build stage: install deps & run tests
FROM node:20-alpine AS build

WORKDIR /app

# Install curl for healthcheck probing during optional tests, and bash if needed
RUN apk add --no-cache curl bash

# Copy dependency manifests first (better layer caching)
COPY package*.json ./

# Install production dependencies only (dev deps not needed; tests don't rely on nodemon)
# Fallback to npm install if lock file absent
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy source code
COPY . .

# Run lightweight tests (fail build if tests fail)
RUN npm test

# ------------------------------------------------------------
# Runtime stage: minimal image
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Add curl for container HEALTHCHECK
RUN apk add --no-cache curl

# Copy built app & node_modules from build stage
COPY --from=build /app /app

# For security: use non-root user provided by base image
USER node

# Expose default port (can be overridden via PORT env var)
EXPOSE 3000

# Healthcheck hits Express /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fs http://localhost:${PORT:-3000}/api/health || exit 1

# Required environment variables:
# - MONGODB_URI: Mongo connection string (mandatory)
# Optional environment variables:
# - PORT: Express listen port (defaults to 3000)
# - MEDIA_SERVICE_BASE_URL: Base URL for media assets
# - NODE_ENV: Set automatically to production

# Start the server
CMD ["node", "server.js"]

# ------------------------------------------------------------
# Usage examples:
# Build:   docker build -t line-crossings:latest .
# Run:     docker run --rm -p 3000:3000 -e MONGODB_URI="mongodb://user:pass@host:27017/historian?authSource=admin" line-crossings:latest
# Custom port: docker run --rm -p 8080:8080 -e PORT=8080 -e MONGODB_URI=... line-crossings:latest
# ------------------------------------------------------------

