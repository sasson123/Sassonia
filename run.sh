#!/usr/bin/with-contenv bashio

export GEMINI_API_KEY=$(bashio::config 'gemini_api_key')
export DATA_DIR="/data"

bashio::log.info "Starting Sassonia..."
cd /app/backend
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8099
