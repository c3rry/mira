# production container for mira frontend hud & canvas
FROM node:18-alpine

WORKDIR /app

# install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# copy application sources
COPY . .

# configure runtime environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV BACKEND_INTERNAL_URL="http://backend:8000"

# build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
