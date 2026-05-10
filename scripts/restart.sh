#!/usr/bin/env bash

echo "🧹 Hard resetting Glade..."

# Kill anything running on the Vite dev port
echo "Closing port 1420..."
lsof -ti:1420 | xargs kill -9 2>/dev/null || true

# Kill any lingering Tauri/Vite processes
echo "Terminating lingering dev processes..."
pkill -f "tauri dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Since the Mac app might be named after the Rust project, let's kill that too
# Checking if there's any 'glade' process running from the target directory
pkill -f "target/debug/glade" 2>/dev/null || true

echo "🚀 Starting fresh Tauri dev instance..."
npm run tauri dev
