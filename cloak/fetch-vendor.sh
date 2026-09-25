#!/bin/sh
# The page loads three.js from a CDN. The checks run offline, so they need
# local copies of three.js, the addons the scene and checks use, and
# lottie-web for playing the reference loader.
set -e
cd "$(dirname "$0")"
mkdir -p vendor/loaders vendor/utils
fetch() {  # fetch <package> <version>
  curl -s "https://registry.npmjs.org/$1/$2" \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['dist']['tarball'])" \
    | xargs curl -sSL -o "/tmp/$1.tgz"
}
fetch three 0.186.0
tar -xzf /tmp/three.tgz -C /tmp package/build package/examples/jsm
cp /tmp/package/build/three.module.js /tmp/package/build/three.core.js vendor/
cp /tmp/package/examples/jsm/controls/OrbitControls.js vendor/
cp /tmp/package/examples/jsm/environments/RoomEnvironment.js vendor/
cp /tmp/package/examples/jsm/loaders/GLTFLoader.js vendor/loaders/
cp /tmp/package/examples/jsm/utils/BufferGeometryUtils.js /tmp/package/examples/jsm/utils/SkeletonUtils.js vendor/utils/
fetch lottie-web 5.13.0
tar -xzf /tmp/lottie-web.tgz -C /tmp package/build/player/lottie.min.js
cp /tmp/package/build/player/lottie.min.js vendor/
echo "vendored three.js 0.186.0 + addons, lottie-web 5.13.0 -> vendor/"
