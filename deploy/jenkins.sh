#!/usr/bin/env bash
# Satu pintu masuk untuk job Jenkins (Freestyle "Execute shell" maupun Jenkinsfile).
set -euo pipefail

cd "${WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
branch="${GIT_BRANCH:-$(git branch --show-current)}"
echo "Build commit $(git rev-parse --short HEAD) dari $branch"

bash deploy/ci.sh

# Branch selain main hanya diuji, tidak di-deploy.
case "$branch" in
    main|origin/main|refs/heads/main) bash deploy/deploy.sh ;;
    *) echo 'Bukan branch main: deployment dilewati.' ;;
esac
