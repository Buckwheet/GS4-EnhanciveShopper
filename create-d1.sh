#!/bin/bash
# Get account ID from wrangler
ACCOUNT_ID=$(npx wrangler whoami 2>/dev/null | grep "Account ID" | awk '{print $3}')

if [ -z "$ACCOUNT_ID" ]; then
  echo "Could not get account ID. Please run this manually:"
  echo "npx wrangler d1 create enhancive-db"
  exit 1
fi

echo "Creating D1 database..."
echo "If this fails, please run manually: npx wrangler d1 create enhancive-db"
