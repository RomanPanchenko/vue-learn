FROM node:8-wheezy

ADD ./ /app
WORKDIR /app

ENV NODE_PATH=/usr/local/lib/node_modules
RUN npm install -g pm2@2 @vue/cli shelljs

ENV NODE_ENV=development
RUN npm install -q

VOLUME /app/src

CMD ["pm2-docker", "start", "infra/apps.json"]
