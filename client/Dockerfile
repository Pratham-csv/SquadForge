# Build React app, serve with nginx
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# CRA bakes these in at build time (browser will call host machine ports)
ARG REACT_APP_API_URL=http://localhost:5001
ARG REACT_APP_LOCALHOST_KEY=squadforge-user
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_LOCALHOST_KEY=$REACT_APP_LOCALHOST_KEY
ENV CI=false

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
