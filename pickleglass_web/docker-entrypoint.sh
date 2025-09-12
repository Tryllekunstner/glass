#!/bin/sh
set -e

echo "=== Container Startup Script ==="
echo "Starting at: $(date)"
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Environment validation
echo "=== Environment Validation ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "PORT: ${PORT:-not set}"
echo "HOSTNAME: ${HOSTNAME:-not set}"

# Validate required environment variables
if [ -z "$PORT" ]; then
    echo "ERROR: PORT environment variable is not set"
    exit 1
fi

if [ -z "$NODE_ENV" ]; then
    echo "WARNING: NODE_ENV environment variable is not set, defaulting to production"
    export NODE_ENV=production
fi

# Validate port is numeric and within valid range
if ! echo "$PORT" | grep -qE '^[0-9]+$'; then
    echo "ERROR: PORT must be a number, got: $PORT"
    exit 1
fi

if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "ERROR: PORT must be between 1 and 65535, got: $PORT"
    exit 1
fi

# Check if we're running in Cloud Run
if [ -n "$K_SERVICE" ]; then
    echo "=== Cloud Run Environment Detected ==="
    echo "Service: $K_SERVICE"
    echo "Revision: ${K_REVISION:-not set}"
    echo "Configuration: ${K_CONFIGURATION:-not set}"
fi

# Validate Next.js build exists
if [ ! -d ".next" ]; then
    echo "ERROR: .next directory not found. Make sure 'npm run build' was executed during Docker build."
    exit 1
fi

# Check if standalone build exists (for output: 'standalone' config)
if [ -f "server.js" ]; then
    echo "Using custom server.js"
elif [ -f ".next/standalone/server.js" ]; then
    echo "Using Next.js standalone server"
else
    echo "ERROR: No server file found"
    exit 1
fi

# Container health and readiness checks
echo "=== Container Health Checks ==="

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory (if available)
if [ -f /proc/meminfo ]; then
    MEMORY_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEMORY_AVAILABLE=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    MEMORY_USAGE=$((100 - (MEMORY_AVAILABLE * 100 / MEMORY_TOTAL)))
    echo "Memory usage: ${MEMORY_USAGE}%"
fi

echo "=== Starting Application ==="
echo "Command: $@"
echo "Working directory: $(pwd)"
echo "User: $(whoami)"

# Execute the main command
exec "$@"
