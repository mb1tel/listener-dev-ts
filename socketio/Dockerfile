## Build stage
FROM node:16-alpine AS builder

WORKDIR /app

# Set NODE_ENV to development for build
ENV NODE_ENV=development

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies for build
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

## Production stage
FROM node:16-alpine

WORKDIR /app

# Define build argument again (not inherited from previous stage)
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy package files
COPY package*.json ./

# Install dependencies based on environment
RUN if [ "$NODE_ENV" = "production" ] ; then npm ci --only=production ; else npm ci ; fi

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Handle .env files based on environment
RUN if [ "$NODE_ENV" = "development" ] ; then \
    echo "Setting up for development environment" ; \
    else \
    echo "Setting up for production environment" ; \
    fi

# Create a script to handle environment setup at container startup
RUN echo "#!/bin/sh" > /app/start.sh && \
    echo "if [ \"\$NODE_ENV\" = \"development\" ] && [ -f /env/.env ]; then" >> /app/start.sh && \
    echo "  echo 'Using .env file from mounted volume'" >> /app/start.sh && \
    echo "  cp /env/.env /app/.env" >> /app/start.sh && \
    echo "fi" >> /app/start.sh && \
    echo "npm start" >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 3000

# Create a volume for potentially mounting .env files
VOLUME /env

# Start the server using our custom start script
CMD ["/app/start.sh"] 