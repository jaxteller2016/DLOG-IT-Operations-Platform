#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://192.168.100.5:5000"
API_BASE_URL=""
EMAIL="admin@example.com"
PASSWORD="Admin123!"
ASSET_ID=""
SERIAL_NUMBER=""
IP_ADDRESS="192.168.20.45"
MAC_ADDRESS=""
OPERATING_SYSTEM="$(sw_vers -productName 2>/dev/null || echo macOS) $(sw_vers -productVersion 2>/dev/null || echo)"
CPU_USAGE="42"
MEMORY_USAGE="71"
DISK_FREE_PERCENT="12"
BACKUP_STATUS="failed"
INTERVAL_SECONDS="0"

usage() {
  cat <<'EOF'
Usage: ./simulate-heartbeat.sh [options]

Options:
  --base-url URL            App or API base URL (default: http://192.168.100.5:5000)
  --email EMAIL             Login email (default: admin@example.com)
  --password PASSWORD       Login password (default: Admin123!)
  --asset-id ID             Asset ID to simulate heartbeat for (optional, auto-derived when omitted)
  --serial-number VALUE     Device serial number (default: auto-detect)
  --ip-address IP           Reported device IP (default: 192.168.20.45)
  --mac-address VALUE       Device MAC address (default: auto-detect)
  --operating-system VALUE  Device operating system (default: auto-detect)
  --cpu N                   CPU usage percent (default: 42)
  --memory N                Memory usage percent (default: 71)
  --disk N                  Disk free percent (default: 12)
  --backup STATUS           Backup status: ok or failed (default: failed)
  --interval SECONDS        Repeat heartbeat every N seconds (default: 0, send once)
  --help                    Show this help
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

json_read() {
  local expression="$1"
  python3 -c "import json,sys; data=json.load(sys.stdin); value=${expression}; print('' if value is None else value)"
}

is_json() {
  python3 -c "import json,sys; json.load(sys.stdin)" >/dev/null 2>&1
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_header="${4:-}"

  local curl_args=( -sS -X "$method" "$url" )
  if [[ -n "$auth_header" ]]; then
    curl_args+=( -H "$auth_header" )
  fi
  if [[ -n "$body" ]]; then
    curl_args+=( -H "Content-Type: application/json" -d "$body" )
  fi

  curl "${curl_args[@]}"
}

try_login() {
  local api_base_url="$1"
  local payload="$2"
  local response
  response=$(request_json "POST" "$api_base_url/auth/login" "$payload")

  if ! printf '%s' "$response" | is_json; then
    echo ""
    return 0
  fi

  local token
  token=$(printf '%s' "$response" | json_read "data.get('token', '')")
  if [[ -n "$token" ]]; then
    printf '%s\n%s' "$api_base_url" "$response"
    return 0
  fi

  echo ""
}

resolve_api_base_url() {
  local normalized_base_url="$1"
  local payload="$2"
  local login_result

  if [[ "$normalized_base_url" == */api ]]; then
    login_result=$(try_login "$normalized_base_url" "$payload")
    if [[ -n "$login_result" ]]; then
      printf '%s' "$login_result"
      return 0
    fi
  else
    login_result=$(try_login "$normalized_base_url" "$payload")
    if [[ -n "$login_result" ]]; then
      printf '%s' "$login_result"
      return 0
    fi

    login_result=$(try_login "$normalized_base_url/api" "$payload")
    if [[ -n "$login_result" ]]; then
      printf '%s' "$login_result"
      return 0
    fi
  fi

  return 1
}

detect_serial_number() {
  if [[ -n "$SERIAL_NUMBER" ]]; then
    return
  fi

  SERIAL_NUMBER=$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Serial Number/{print $2; exit}')
  SERIAL_NUMBER=${SERIAL_NUMBER:-"UNKNOWN-SERIAL"}
}

detect_ip_address() {
  if [[ "$IP_ADDRESS" != "192.168.20.45" ]]; then
    return
  fi

  local detected
  detected=$(ipconfig getifaddr en0 2>/dev/null || true)
  if [[ -z "$detected" ]]; then
    detected=$(ipconfig getifaddr en1 2>/dev/null || true)
  fi

  if [[ -n "$detected" ]]; then
    IP_ADDRESS="$detected"
  fi
}

detect_mac_address() {
  if [[ -n "$MAC_ADDRESS" ]]; then
    return
  fi

  MAC_ADDRESS=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2; exit}')
  if [[ -z "$MAC_ADDRESS" ]]; then
    MAC_ADDRESS=$(ifconfig en1 2>/dev/null | awk '/ether/{print $2; exit}')
  fi

  MAC_ADDRESS=${MAC_ADDRESS:-"00:00:00:00:00:00"}
}

detect_asset_id() {
  if [[ -n "$ASSET_ID" ]]; then
    return
  fi

  local serial_clean
  serial_clean=$(printf '%s' "$SERIAL_NUMBER" | tr -cd '[:alnum:]')

  if [[ -n "$serial_clean" ]]; then
    ASSET_ID="HB-${serial_clean}"
    return
  fi

  local mac_clean
  mac_clean=$(printf '%s' "$MAC_ADDRESS" | tr -cd '[:alnum:]')
  if [[ -n "$mac_clean" ]]; then
    ASSET_ID="HB-${mac_clean}"
    return
  fi

  ASSET_ID="HB-$(date +%s)"
}

send_heartbeat() {
  local token="$1"
  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  local payload
  payload=$(cat <<EOF
  {"assetId":"$ASSET_ID","serialNumber":"$SERIAL_NUMBER","timestamp":"$timestamp","ipAddress":"$IP_ADDRESS","macAddress":"$MAC_ADDRESS","operatingSystem":"$OPERATING_SYSTEM","cpuUsage":$CPU_USAGE,"memoryUsage":$MEMORY_USAGE,"diskFreePercent":$DISK_FREE_PERCENT,"backupStatus":"$BACKUP_STATUS"}
EOF
)

  local response
  response=$(request_json "POST" "$API_BASE_URL/monitoring/heartbeat" "$payload" "Authorization: Bearer $token")

  if ! printf '%s' "$response" | is_json; then
    echo "Heartbeat request failed. Response:" >&2
    echo "$response" >&2
    exit 1
  fi

  local alert_count
  alert_count=$(printf '%s' "$response" | json_read "len(data.get('alerts', []))")
  echo "[$timestamp] Heartbeat sent for asset $ASSET_ID. Alerts returned: $alert_count"

  if [[ "$alert_count" != "0" ]]; then
    printf '%s' "$response" | python3 -c "import json,sys; data=json.load(sys.stdin); [print(f\"  - {item.get('type')}: {item.get('message')}\") for item in data.get('alerts', [])]"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --asset-id)
      ASSET_ID="$2"
      shift 2
      ;;
    --ip-address)
      IP_ADDRESS="$2"
      shift 2
      ;;
    --serial-number)
      SERIAL_NUMBER="$2"
      shift 2
      ;;
    --mac-address)
      MAC_ADDRESS="$2"
      shift 2
      ;;
    --operating-system)
      OPERATING_SYSTEM="$2"
      shift 2
      ;;
    --cpu)
      CPU_USAGE="$2"
      shift 2
      ;;
    --memory)
      MEMORY_USAGE="$2"
      shift 2
      ;;
    --disk)
      DISK_FREE_PERCENT="$2"
      shift 2
      ;;
    --backup)
      BACKUP_STATUS="$2"
      shift 2
      ;;
    --interval)
      INTERVAL_SECONDS="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$BACKUP_STATUS" != "ok" && "$BACKUP_STATUS" != "failed" ]]; then
  echo "--backup must be either ok or failed" >&2
  exit 1
fi

require_command curl
require_command python3

detect_serial_number
detect_ip_address
detect_mac_address
detect_asset_id

BASE_URL="${BASE_URL%/}"

login_payload=$(cat <<EOF
{"email":"$EMAIL","password":"$PASSWORD"}
EOF
)

login_result=$(resolve_api_base_url "$BASE_URL" "$login_payload") || {
  echo "Login failed. The server did not return a valid JSON auth response from either $BASE_URL/auth/login or $BASE_URL/api/auth/login" >&2
  exit 1
}

API_BASE_URL=$(printf '%s' "$login_result" | head -n 1)
login_response=$(printf '%s' "$login_result" | tail -n +2)
token=$(printf '%s' "$login_response" | json_read "data.get('token', '')")

if [[ -z "$token" ]]; then
  echo "Login failed. Response:" >&2
  echo "$login_response" >&2
  exit 1
fi

echo "Authenticated to $API_BASE_URL as $EMAIL"
echo "Sending heartbeats for asset $ASSET_ID"
echo "Serial: $SERIAL_NUMBER | IP: $IP_ADDRESS | MAC: $MAC_ADDRESS | OS: $OPERATING_SYSTEM"

if [[ "$INTERVAL_SECONDS" == "0" ]]; then
  send_heartbeat "$token"
  exit 0
fi

echo "Repeating every $INTERVAL_SECONDS second(s). Press Ctrl+C to stop."
while true; do
  send_heartbeat "$token"
  sleep "$INTERVAL_SECONDS"
done