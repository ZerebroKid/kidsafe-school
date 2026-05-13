FROM node:20.19.6

WORKDIR /app

COPY . .

RUN npm ci --no-audit
