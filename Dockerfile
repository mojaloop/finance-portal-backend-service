FROM node:12.16.1-alpine AS builder
WORKDIR /opt/finance-portal-backend-service

RUN apk add --no-cache -t build-dependencies git make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY ./src/package.json ./src/package-lock.json /opt/finance-portal-backend-service/
RUN npm install

FROM node:12.16.1-alpine
WORKDIR /opt/finance-portal-backend-service

COPY --from=builder /opt/finance-portal-backend-service /opt/finance-portal-backend-service
COPY ./src /opt/finance-portal-backend-service

CMD ["node", "/opt/finance-portal-backend-service/index.js"]
