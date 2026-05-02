#!/usr/bin/env bash
# 將目前變動一次 commit 並 push 到 upstream（需在專案根目錄執行）。
# 用法：
#   npm run git:publish -- "your commit message"
# 或未安裝 npm 時：
#   bash scripts/git-publish.sh "your commit message"

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $# -eq 0 ]]; then
  echo "請提供 commit 訊息，例如：" >&2
  echo '  npm run git:publish -- "說明這次改了什麼"' >&2
  exit 1
fi

MESSAGE="$*"

git add -A
if git diff --cached --quiet; then
  echo "沒有可提交的變更，略過 commit。" >&2
else
  git commit -m "$MESSAGE"
fi

git push
