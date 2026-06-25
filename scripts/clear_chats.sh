#!/usr/bin/env bash
# 清空 studio 历史对话（AGUI minimal 改造后，旧 events 字段已废弃，无法回放）
# 用法： bash studio/scripts/clear_chats.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${STUDIO_DATA_DIR:-$SCRIPT_DIR/../data}"
CHATS_DIR="$DATA_DIR/chats"

if [[ ! -d "$CHATS_DIR" ]]; then
  echo "[clear_chats] chats dir not found: $CHATS_DIR"
  exit 0
fi

echo "[clear_chats] target: $CHATS_DIR"
ls -la "$CHATS_DIR" || true

read -r -p "确认清空以上所有会话与消息？(y/N) " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "[clear_chats] aborted."
  exit 0
fi

# 删除目录下所有内容，但保留 chats 目录本身
find "$CHATS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
echo "[clear_chats] done."
