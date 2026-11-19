FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && pip3 install --break-system-packages -U yt-dlp && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN mkdir -p public/clips && npm run build
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
