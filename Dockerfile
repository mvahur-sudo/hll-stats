FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN cp -r node_modules /node_modules_cache && \
    rm -rf node_modules

EXPOSE 3124
CMD ["sh", "-c", "mkdir -p /app/node_modules && cp -r /node_modules_cache/* /app/node_modules/ && node server.js"]
