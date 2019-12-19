FROM node:8.11.3-alpine AS builder
WORKDIR /opt/finance-portal-backend-service

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY ./src/package.json ./src/package-lock.json /opt/finance-portal-backend-service/
RUN npm install

FROM node:8.11.3-alpine
WORKDIR /opt/finance-portal-backend-service

COPY --from=builder /opt/finance-portal-backend-service ./src
COPY ./src ./src

CMD ["node", "src/index.js"]