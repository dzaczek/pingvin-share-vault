#!/bin/sh

# Copy default logo to the frontend public folder if it doesn't exist
cp -rn /tmp/img/* /opt/app/frontend/public/img

if [ "$CADDY_DISABLED" != "true" ]; then
  # Start Caddy
  echo "Starting Caddy..."
  if [ "$TRUST_PROXY" = "true" ]; then
    # an empty value would trust nobody instead of the default ranges, and a
    # value Caddy cannot parse, like a URL, would stop it from starting at
    # all. Both fall back to the private networks.
    [ -z "$TRUST_PROXY_FROM" ] && unset TRUST_PROXY_FROM
    if [ -n "$TRUST_PROXY_FROM" ] && ! caddy validate --adapter caddyfile \
      --config /opt/app/reverse-proxy/Caddyfile.trust-proxy >/dev/null 2>&1; then
      echo "TRUST_PROXY_FROM is not a list of addresses or ranges, using the private networks instead: $TRUST_PROXY_FROM"
      unset TRUST_PROXY_FROM
    fi
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile.trust-proxy &
  else
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile &
  fi
else
  echo "Caddy is disabled. Skipping..."
fi

# Run the frontend server
PORT=3333 HOSTNAME=0.0.0.0 node frontend/server.js &

# Run the backend server
cd backend && ./node_modules/.bin/prisma migrate deploy && node dist/prisma/seed/config.seed.js && node dist/src/main

# Wait for all processes to finish
wait -n
