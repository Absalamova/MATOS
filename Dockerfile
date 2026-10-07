# MATOS API — no npm dependencies, runs TypeScript directly on Node 24.
#   docker build -t matos-api .
#   docker run -d -p 8080:8080 -v matos-data:/data --env-file server/.env matos-api
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
COPY package.json ./
COPY shared ./shared
COPY server/src ./server/src
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.ts"]
