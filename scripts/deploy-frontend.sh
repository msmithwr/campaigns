#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${AWS_PROFILE:-cloudwrxs-mdf}"
REGION="${AWS_REGION:-us-east-1}"
FRONTEND_BUCKET="${CAMPAIGN_FRONTEND_BUCKET:-cloudwrxs-campaign-command-dev-522135868204}"
CLOUDFRONT_DISTRIBUTION_ID="${CAMPAIGN_CLOUDFRONT_DISTRIBUTION_ID:-EUOE6C8LPFQ73}"

export VITE_CAMPAIGN_API_URL="${VITE_CAMPAIGN_API_URL:-https://7v2823phoa.execute-api.us-east-1.amazonaws.com}"
export VITE_COGNITO_DOMAIN="${VITE_COGNITO_DOMAIN:-https://cloudwrxs-campaign-command-dev-522135868204.auth.us-east-1.amazoncognito.com}"
export VITE_COGNITO_CLIENT_ID="${VITE_COGNITO_CLIENT_ID:-e5gc39ru1jjgahp48be6nlarb}"
export VITE_COGNITO_REDIRECT_URI="${VITE_COGNITO_REDIRECT_URI:-https://campaigns.cloudwrxs.com}"
export VITE_COGNITO_LOGOUT_URI="${VITE_COGNITO_LOGOUT_URI:-https://campaigns.cloudwrxs.com}"

cd "$ROOT_DIR"
npm run build

aws s3 sync dist/assets "s3://$FRONTEND_BUCKET/assets" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --profile "$PROFILE" \
  --region "$REGION"

aws s3 cp dist/index.html "s3://$FRONTEND_BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html" \
  --profile "$PROFILE" \
  --region "$REGION"

INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Invalidation.Id" \
  --output text)"

echo "Created CloudFront invalidation $INVALIDATION_ID"
aws cloudfront wait invalidation-completed \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID" \
  --profile "$PROFILE" \
  --region "$REGION"

echo "Frontend deployed to https://campaigns.cloudwrxs.com"
