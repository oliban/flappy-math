FROM node:22-alpine

WORKDIR /app

# No runtime dependencies - the server uses only the Node standard library.
COPY package.json ./
COPY index.html site.webmanifest og-image.png icon-512.png apple-touch-icon.png favicon.png robots.txt ./
COPY css ./css
COPY js ./js
COPY sounds ./sounds
COPY server ./server

# Leaderboard data lives on a Fly volume mounted here (see fly.toml).
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/server.js"]
