# Build Stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Accept build arguments for VITE config
# (nilai ENV mengalahkan file .env saat build — wajib untuk VITE_BACKEND_URL)
ARG VITE_BACKEND_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PRASASTI_API_URL
ARG VITE_R2_WORKER_URL
ARG VITE_EMAIL_NOTIFICATION_URL
ARG VITE_SESSION_IDLE_MINUTES=30
ARG VITE_SESSION_MAX_MINUTES=720
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PRASASTI_API_URL=$VITE_PRASASTI_API_URL \
    VITE_R2_WORKER_URL=$VITE_R2_WORKER_URL \
    VITE_EMAIL_NOTIFICATION_URL=$VITE_EMAIL_NOTIFICATION_URL \
    VITE_SESSION_IDLE_MINUTES=$VITE_SESSION_IDLE_MINUTES \
    VITE_SESSION_MAX_MINUTES=$VITE_SESSION_MAX_MINUTES

RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
# Note: The docker-compose.yml currently mounts this, but copying it here makes the image self-contained
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
