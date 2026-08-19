FROM node:18
# دابەزاندنی پایتۆن و yt-dlp لەسەر سێرڤەرەکە
RUN apt-get update && apt-get install -y python3 curl ffmpeg
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
