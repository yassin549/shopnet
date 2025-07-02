FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json .
RUN npm install --production

# Copy source code
COPY packages ./packages
COPY themes ./themes
COPY extensions ./extensions
COPY public ./public
COPY media ./media
COPY config ./config
COPY translations ./translations

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine
WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/themes ./themes
COPY --from=builder /app/extensions ./extensions
COPY --from=builder /app/public ./public
COPY --from=builder /app/media ./media
COPY --from=builder /app/config ./config
COPY --from=builder /app/translations ./translations
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=80

# Expose port and start command
EXPOSE 80
CMD ["npm", "run", "start"]
