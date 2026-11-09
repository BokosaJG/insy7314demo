#!/bin/sh
# Container start-up script for the API.
#  1. If HTTPS is on and there is no certificate yet, create a self-signed one.
#  2. Optionally create the first Admin account (SEED_ADMIN=true).
#  3. Hand over to the main process (exec, so it receives SIGTERM from Docker).
set -e

if [ "$USE_HTTPS" = "true" ]; then
  KEY="${SSL_KEY_PATH:-/app/certs/localhost-key.pem}"
  CERT="${SSL_CERT_PATH:-/app/certs/localhost-cert.pem}"
  if [ ! -f "$KEY" ] || [ ! -f "$CERT" ]; then
    echo '{"level":"info","event":"entrypoint.tls_generate","message":"Generating self-signed TLS certificate"}'
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -keyout "$KEY" -out "$CERT" \
      -subj "/CN=api" \
      -addext "subjectAltName=DNS:api,DNS:localhost,IP:127.0.0.1" 2>/dev/null
    chmod 600 "$KEY"
  fi
fi

if [ "$SEED_ADMIN" = "true" ]; then
  node scripts/seedAdmin.js || true   # "Admin already exists" is not an error
fi

exec "$@"
