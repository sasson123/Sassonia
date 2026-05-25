ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.0.0
FROM $BUILD_FROM

# Install Python, Node.js, and build tools
RUN apk add --no-cache python3 py3-pip nodejs npm gcc musl-dev python3-dev

WORKDIR /app

# Build React frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install --silent

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Install Python backend
COPY backend/requirements.txt ./backend/
RUN pip3 install --no-cache-dir -r backend/requirements.txt --break-system-packages

COPY backend/ ./backend/

COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
