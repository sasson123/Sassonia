# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json ./
RUN npm install --silent
COPY frontend/ ./
RUN apk add --no-cache librsvg && \
    rsvg-convert -w 192 -h 192 public/icon.svg -o public/icon-192.png && \
    rsvg-convert -w 512 -h 512 public/icon.svg -o public/icon-512.png
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.11-alpine
RUN apk add --no-cache gcc musl-dev libffi-dev

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/dist ./frontend/dist

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
