#!/bin/bash

# Build script for WASM PHI Redaction module

echo "🔨 Building WASM PHI Redaction module..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack is not installed. Installing..."
    cargo install wasm-pack
fi

# Build the WASM module
echo "📦 Building WASM module..."
wasm-pack build --target web --out-dir pkg

if [ $? -eq 0 ]; then
    echo "✅ WASM module built successfully!"
    echo "📁 Output files:"
    ls -la pkg/
    echo ""
    echo "🚀 To use in your project:"
    echo "   1. Copy pkg/ files to your public directory"
    echo "   2. Import and initialize the WASM module"
    echo "   3. Use the redaction functions"
else
    echo "❌ Failed to build WASM module"
    exit 1
fi
