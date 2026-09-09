#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$DIR/src-tauri/target/release/bnet-linux-launcher"

if [ ! -f "$BIN" ] || [ "$1" = "--build" ] || [ "$1" = "--rebuild" ]; then
    echo "Building launcher release binary..."
    (cd "$DIR" && npm run build && cargo build --release --manifest-path src-tauri/Cargo.toml)
    if [ "$1" = "--build" ] || [ "$1" = "--rebuild" ]; then
        shift || true
    fi
fi

echo "Launching Battle.net Linux Launcher..."
exec "$BIN" "$@"

