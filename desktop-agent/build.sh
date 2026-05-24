#!/bin/bash
# Build desktop agent into a standalone executable
# Run: chmod +x build.sh && ./build.sh

pip install -r requirements.txt

pyinstaller \
  --onefile \
  --windowed \
  --name "BPOWorkforceAgent" \
  --add-data "." \
  agent.py

echo "Build complete. Executable is in dist/BPOWorkforceAgent"
