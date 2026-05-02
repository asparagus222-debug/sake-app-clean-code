#!/usr/bin/env bash
# Agent「正常結束」時：自動 git add/commit/push（與 npm run git:publish 同源邏輯）。
# 失敗不中斷 IDE：錯誤寫 stderr，並輸出空 JSON {}（不送 follow-up）。
set +e
set +o pipefail 2>/dev/null || true
INPUT=$(cat)
STATUS="$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(str(d.get('status', 'completed')))
except Exception:
    print('completed')
" 2>/dev/null)"
[[ -z "$STATUS" ]] && STATUS="completed"

if [[ "$STATUS" != "completed" ]]; then
  echo '{}'
  exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" ]]; then
  echo '[agent-stop-push] 非 git 專案，略過。' >&2
  echo '{}'
  exit 0
fi

COMMIT_MSG="agent(auto): $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
cd "$ROOT" || exit 0
bash scripts/git-publish.sh "$COMMIT_MSG" >&2 || echo '[agent-stop-push] git:publish 失敗（請檢查变更、远端、認證）。' >&2
echo '{}'
exit 0
