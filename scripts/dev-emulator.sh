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

# Build --only list dynamically based on what's actually deployable.
# Functions emulator is added as soon as there's at least one callable / trigger
# source file. Pre-P4.1.1 this directory didn't exist, so the emulator booted
# auth+firestore only. P4.1.1 added the first callable (ping); from here on the
# functions emulator joins the lineup automatically.
ONLY="auth,firestore"
if ls apps/functions/src/callable/*.ts apps/functions/src/triggers/*.ts apps/functions/src/crons/*.ts >/dev/null 2>&1; then
  # Ensure the JS build is fresh before the emulator scans dist/index.js --
  # firebase-tools won't auto-build TypeScript for us.
  echo "[dev-emulator] callables/triggers detected -> building functions before emulator boot"
  pnpm --filter @zerebro/functions build
  ONLY="$ONLY,functions"
fi

exec firebase emulators:start \
  --import="$EMULATOR_DATA_DIR" \
  --export-on-exit="$EMULATOR_DATA_DIR" \
  --only="$ONLY"
