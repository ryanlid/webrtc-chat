FROM node:lts

WORKDIR /app

COPY . /app

RUN node -v \
  && npm -v \
  && npm install --production

EXPOSE 3000

CMD ["npm", "start"]
