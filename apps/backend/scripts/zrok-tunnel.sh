#!/usr/bin/env bash
set -e

# Safely resolve PORT while preserving environment-variable precedence
if [ -z "$PORT" ]; then
  if [ -f .env ]; then
    ENV_PORT=$(grep -E '^PORT=' .env | head -n 1 | cut -d '=' -f2 | tr -d '\r"'\''')
    PORT="${ENV_PORT:-3000}"
  else
    PORT=3000
  fi
fi

if ! command -v zrok &> /dev/null; then
  echo ""
  echo "=========================================================================="
  echo " ERROR: 'zrok' CLI is not installed on your system."
  echo "=========================================================================="
  echo " Official zrok Installation Steps (https://docs.zrok.io):"
  echo ""
  echo "   - macOS:   brew install zrok"
  echo "   - Linux:   bash -c \"\$(curl -sS https://zrok.io/install.sh)\""
  echo "   - Windows: scoop install zrok"
  echo ""
  echo " Account Setup & Environment Activation:"
  echo "   1. Register / login at https://zrok.io"
  echo "   2. Enable environment: zrok enable <your_user_token>"
  echo "=========================================================================="
  echo ""
  exit 1
fi

echo ""
echo "=========================================================================="
echo "  REVENUE RECOVERY ENGINE — ZROK LOCAL WEBHOOK TUNNEL"
echo "=========================================================================="
echo "  Local Target:   http://localhost:${PORT}"
echo "  Webhook Route:  /api/v1/webhooks/razorpay/<merchantId>"
echo "=========================================================================="
echo "  1. Copy the public https://*.share.zrok.io URL displayed below."
echo "  2. Construct URL: https://<zrok-url>/api/v1/webhooks/razorpay/<merchantId>"
echo "  3. Configure endpoint in Razorpay Test Dashboard."
echo "=========================================================================="
echo ""

exec zrok share public "http://localhost:${PORT}"
