# Use official Node.js LTS image
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source code
COPY ./dist ./dist

# Expose port
EXPOSE 3000

# Set environment variables (to be overridden by ECS task definition)
ENV NODE_ENV=production

# Default command (update if you have a server entrypoint)
CMD ["node", "dist/index.js"]
