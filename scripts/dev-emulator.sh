#!/usr/bin/env bash
# Boot Firebase Emulators with auto import/export of local data.
# Used by every developer for local development across all Zerebro apps.
#
# Usage:
#   pnpm dev:emulator            # boot emulators (auth, firestore today; +functions in P3.1.1)
#   bash scripts/dev-emulator.sh # same, direct invocation
#
# Requirements:
#   - JDK 21+ (firebase-tools 14+ no longer supports older Java)
#     Install on Ubuntu/Debian:  sudo apt install openjdk-21-jdk
#     Install on macOS (brew):   brew install openjdk@21
#
# Data persists between runs in ./.emulator-data/ (gitignored).
# As more emulators get configured (functions in P3.1.1, hosting in P2.4), expand --only below.

set -euo pipefail

EMULATOR_DATA_DIR=".emulator-data"

# Prefer JDK 21+ if installed but not the default (firebase-tools 14+ requires it).
if [ -d "/usr/lib/jvm/java-21-openjdk-amd64" ]; then
  export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
  export PATH="$JAVA_HOME/bin:$PATH"
elif [ -d "/usr/lib/jvm/java-1.21.0-openjdk-amd64" ]; then
  export JAVA_HOME="/usr/lib/jvm/java-1.21.0-openjdk-amd64"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [ ! -d "$EMULATOR_DATA_DIR" ]; then
  mkdir -p "$EMULATOR_DATA_DIR"
  echo "Created $EMULATOR_DATA_DIR (first run)"
fi

# Build --only list dynamically based on what's configured in firebase.json.
ONLY="auth,firestore"
if grep -q '"functions"' apps/functions/package.json 2>/dev/null; then
  ONLY="$ONLY,functions"
fi

exec firebase emulators:start \
  --import="$EMULATOR_DATA_DIR" \
  --export-on-exit="$EMULATOR_DATA_DIR" \
  --only="$ONLY"
