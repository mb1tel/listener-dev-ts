FROM node:16-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install ALL dependencies, including devDependencies for build
RUN npm install

# Copy project files
COPY . .

# Ensure src directory exists
RUN mkdir -p src

# Make sure tsconfig.json is present
COPY tsconfig.json ./

# Transpile TypeScript
RUN npm run build

# Verify if dist directory and server.js exist
RUN ls -la dist || echo "dist directory missing"
RUN ls -la dist/server.js || echo "server.js missing"

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"] 