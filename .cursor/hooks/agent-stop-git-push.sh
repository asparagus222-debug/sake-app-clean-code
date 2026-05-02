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

CHANGED_FILES_RAW="$(git status --porcelain | awk '{print $2}' | sed 's#^"##; s#"$##')"
if [[ -z "$CHANGED_FILES_RAW" ]]; then
  SHORT_DESC="自動提交：未偵測到檔案變更"
else
  FILE_COUNT="$(printf '%s\n' "$CHANGED_FILES_RAW" | sed '/^$/d' | wc -l | tr -d ' ')"
  CHANGED_FILES_BRIEF="$(printf '%s\n' "$CHANGED_FILES_RAW" | sed '/^$/d' | head -n 2 | paste -sd '、' -)"
  MODULE="專案"
  ACTION="更新內容"

  if printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^src/app/notes/'; then
    MODULE="品飲筆記"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^src/app/expo/'; then
    MODULE="品飲活動"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^src/lib/nav|use-layer-back|HierarchicalBackHandler'; then
    MODULE="導航"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq 'README|\.env\.example|docs?/'; then
    MODULE="文件"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^\.cursor/hooks|^scripts/git-publish\.sh'; then
    MODULE="自動發布"
  fi

  if printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^src/lib/sake-data\.ts$'; then
    ACTION="擴增銘柄資料與搜尋別名"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^src/hooks/use-sake-brand-suggestions\.ts$'; then
    ACTION="優化銘柄建議邏輯"
  elif printf '%s\n' "$CHANGED_FILES_RAW" | grep -Eq '^\.cursor/hooks'; then
    ACTION="調整自動提交規則"
  elif [[ "$FILE_COUNT" -eq 1 ]]; then
    ACTION="調整單一檔案設定"
  fi

  SHORT_DESC="${MODULE}：${ACTION}（${FILE_COUNT}檔，${CHANGED_FILES_BRIEF}）"
fi
if [[ ${#SHORT_DESC} -gt 90 ]]; then
  SHORT_DESC="${SHORT_DESC:0:87}..."
fi

COMMIT_MSG="${SHORT_DESC} @ $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
cd "$ROOT" || exit 0
bash scripts/git-publish.sh "$COMMIT_MSG" >&2 || echo '[agent-stop-push] git:publish 失敗（請檢查變更、遠端、認證）。' >&2
echo '{}'
exit 0
