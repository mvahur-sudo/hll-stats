FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Kopeeri kood image'i — see jääb image'i sisse
# Aga kui mountitakse /app kataloogi pealt, node_modules läheb kaotsi
# Sellepärast teeme node_modules eraldi kopeeringu
COPY . .

# Eemalda node_modules põhipathist, et mount ei kataks seda
RUN cp -r node_modules /node_modules_cache && \
    rm -rf node_modules

EXPOSE 3124
CMD ["sh", "-c", "cp -r /node_modules_cache /app/node_modules && node server.js"]
