FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .

EXPOSE 5000

CMD ["yarn", "start"]

