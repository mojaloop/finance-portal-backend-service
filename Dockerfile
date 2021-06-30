FROM node:16-alpine3.13 AS builder
WORKDIR /opt/finance-portal-backend-service

COPY ./src/package.json ./src/package-lock.json /opt/finance-portal-backend-service/
RUN npm ci --only=prod

COPY ./src /opt/finance-portal-backend-service

CMD ["node", "/opt/finance-portal-backend-service/index.js"]
