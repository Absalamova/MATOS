# Seller panel (admin.matos.uz) as a static site served by nginx.
#   docker build -f deploy/admin.Dockerfile -t matos-admin .
# Railway: set RAILWAY_DOCKERFILE_PATH=deploy/admin.Dockerfile on the admin service.
# Optional build variables: VITE_API_URL (default https://api.matos.uz), VITE_STORE_URL (default https://matos.uz/).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_API_URL
ARG VITE_STORE_URL
RUN VITE_API_URL="$VITE_API_URL" VITE_STORE_URL="$VITE_STORE_URL" npm run build:admin

FROM nginx:1.27-alpine
ENV PORT=8080
COPY deploy/admin-nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/admin/dist /usr/share/nginx/html
EXPOSE 8080
