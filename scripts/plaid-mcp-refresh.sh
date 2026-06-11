#!/usr/bin/env bash
# Mint a fresh Plaid Dashboard MCP token (they expire after 15 minutes) and
# (re)register the MCP server in Claude Code with the new Authorization header.
#
# Requires PRODUCTION credentials (the Dashboard MCP only works with
# Production data): https://plaid.com/docs/resources/mcp/
#
# Usage:
#   PLAID_CLIENT_ID=xxx PLAID_PROD_SECRET=yyy ./scripts/plaid-mcp-refresh.sh
# or rely on PLAID_CLIENT_ID from .env.local and pass only PLAID_PROD_SECRET.
set -euo pipefail

if [ -z "${PLAID_CLIENT_ID:-}" ] && [ -f .env.local ]; then
  PLAID_CLIENT_ID=$(grep -oP '^PLAID_CLIENT_ID=\K.*' .env.local)
fi
: "${PLAID_CLIENT_ID:?set PLAID_CLIENT_ID}"
: "${PLAID_PROD_SECRET:?set PLAID_PROD_SECRET (your PRODUCTION secret, not sandbox)}"

TOKEN=$(curl -fsS https://production.plaid.com/oauth/token \
  -H 'Content-Type: application/json' \
  -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"client_secret\":\"$PLAID_PROD_SECRET\",\"grant_type\":\"client_credentials\",\"scope\":\"mcp:dashboard\"}" \
  | grep -oP '"access_token"\s*:\s*"\K[^"]+')

claude mcp remove -s user plaid >/dev/null 2>&1 || true
claude mcp add -s user --transport http plaid https://api.dashboard.plaid.com/mcp \
  --header "Authorization: Bearer $TOKEN"

echo "Plaid Dashboard MCP registered. Token expires in ~15 minutes;"
echo "re-run this script when it does. Restart your Claude Code session to pick it up."
