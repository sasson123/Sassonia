#!/bin/sh
set -e

export DATA_DIR="/data"
export GEMINI_API_KEY=$(python3 -c "
import json, sys
try:
    print(json.load(open('/data/options.json')).get('gemini_api_key',''))
except:
    print('')
" 2>/dev/null || echo "")

echo "[Sassonia] Starting on port 8099..."
cd /app/backend
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8099
