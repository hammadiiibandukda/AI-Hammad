#!/bin/sh
# The page itself loads three.js from a CDN. The QA scripts run offline, so
# they need a local copy; this puts one in vendor/.
set -e
cd "$(dirname "$0")"
mkdir -p vendor
TARBALL=$(curl -s https://registry.npmjs.org/three/0.186.0 \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['dist']['tarball'])")
curl -sSL -o /tmp/three.tgz "$TARBALL"
tar -xzf /tmp/three.tgz -C /tmp package/build/three.module.js package/build/three.core.js
cp /tmp/package/build/three.module.js /tmp/package/build/three.core.js vendor/
echo "vendored three.js 0.186.0 -> vendor/"
