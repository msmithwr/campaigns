#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${AWS_PROFILE:-cloudwrxs-mdf}"
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="${CAMPAIGN_API_FUNCTION_NAME:-campaign-command-api-dev}"
ARTIFACT_BUCKET="${CAMPAIGN_ARTIFACT_BUCKET:-cloudwrxs-campaign-command-dev-522135868204}"
ARTIFACT_KEY="${CAMPAIGN_API_ARTIFACT_KEY:-deployments/campaign-api-dev-results.zip}"
BUILD_DIR="${TMPDIR:-/tmp}/campaign-api-live"
ZIP_FILE="${TMPDIR:-/tmp}/campaign-api-dev.zip"

rm -rf "$BUILD_DIR" "$ZIP_FILE"
mkdir -p "$BUILD_DIR"

cp "$ROOT_DIR/lambda/campaign-api/index.mjs" "$BUILD_DIR/index.mjs"
cp "$ROOT_DIR/lambda/campaign-api/package.json" "$BUILD_DIR/package.json"
cp "$ROOT_DIR/lambda/campaign-api/package-lock.json" "$BUILD_DIR/package-lock.json"

(
  cd "$BUILD_DIR"
  npm ci --omit=dev --silent
  zip -qr "$ZIP_FILE" index.mjs package.json package-lock.json node_modules
)

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_FILE" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query '{FunctionName:FunctionName,LastModified:LastModified}'

aws s3 cp "$ZIP_FILE" "s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY" \
  --profile "$PROFILE" \
  --region "$REGION"

echo "Deployed $FUNCTION_NAME and uploaded s3://$ARTIFACT_BUCKET/$ARTIFACT_KEY"
