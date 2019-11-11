FROM node:8.11.3-alpine AS builder
RUN apk update && apk add git
WORKDIR /src
COPY ./src/package.json ./src/package-lock.json /src/
RUN npm install
FROM node:8.11.3-alpine
WORKDIR /src
CMD ["node", "/src/index.js"]
COPY --from=builder /src /src
COPY ./src /src/
