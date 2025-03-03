FROM node:22-alpine

WORKDIR /app

COPY . .

RUN npm i
RUN npx tsc

ENTRYPOINT [ "node", "dist/index.js" ]