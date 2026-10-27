#!/usr/bin/env bash
set -euo pipefail
cd /workspace/tekaku
export npm_config_cache=/workspace/.npm
export GOPATH=/workspace/.go
export GOCACHE=/workspace/.cache/go-build
export GOPROXY=https://proxy.golang.org
export GOSUMDB=sum.golang.org
export TEKAKU_GO=/workspace/.tools/go/bin/go
if [[ ! -x "$TEKAKU_GO" ]]; then
  archive="$(mktemp /tmp/tekaku-go.XXXXXX.tar.gz)"
  trap 'rm -f "$archive"' EXIT
  curl --fail --location --silent --show-error https://go.dev/dl/go1.27.3.linux-amd64.tar.gz -o "$archive"
  printf '65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40  %s\n' "$archive" | sha256sum --check
  mkdir -p /workspace/.tools
  tar -xzf "$archive" -C /workspace/.tools
fi
"$TEKAKU_GO" version
npm ci
(cd native && "$TEKAKU_GO" mod download)
npm run package:windows
