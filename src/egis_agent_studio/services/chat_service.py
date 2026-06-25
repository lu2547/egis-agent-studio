"""Chat 持久化服务 —— 与 Go 版 ``service/chat_service.go`` 行为严格对齐。

存储结构（``STUDIO_DATA_DIR`` 下）::

    chats/
    ├── <chat_id>.json         ← 会话元数据
    ├── <chat_id>/
    │   ├── 20260614175830_123_user.json
    │   ├── 20260614175845_456_assistant.json
    │   └── ...
    └── ...

会话 ID 采用 ``%Y%m%d%H%M%S`` 格式（与 Go ``time.Now().Format`` 对齐）；
消息文件名 ``%Y%m%d%H%M%S_%f_<role>.json``，保证字典序排序即时间序。
"""

from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from ..models import Chat, Message

logger = logging.getLogger(__name__)


class ChatService:
    """对话持久化服务（纯 JSON 文件，无外部依赖）。"""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.chats_dir = data_dir / "chats"
        self.chats_dir.mkdir(parents=True, exist_ok=True)

    # --- public ---

    def list_chats(self) -> List[Chat]:
        """列出所有会话元数据（按更新时间倒序）。"""
        if not self.chats_dir.is_dir():
            return []
        chats: List[Chat] = []
        for entry in self.chats_dir.iterdir():
            if entry.is_dir() or not entry.name.endswith(".json"):
                continue
            try:
                data = json.loads(entry.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(data, dict):
                continue
            try:
                chats.append(Chat.model_validate(data))
            except Exception:  # noqa: BLE001
                continue
        chats.sort(key=lambda c: c.updated_at.replace(tzinfo=None) if c.updated_at.tzinfo else c.updated_at, reverse=True)
        return chats

    def create_chat(self, agent_id: str, title: str = "") -> Chat:
        """创建新会话（含元数据文件 + 消息目录）。"""
        now = datetime.now(timezone.utc)
        chat_id = now.strftime("%Y%m%d%H%M%S")
        chat = Chat(
            id=chat_id,
            title=title,
            agent_id=agent_id,
            created_at=now,
            updated_at=now,
        )
        meta_file = self.chats_dir / f"{chat_id}.json"
        meta_file.write_text(
            chat.model_dump_json(), encoding="utf-8"
        )
        (self.chats_dir / chat_id).mkdir(parents=True, exist_ok=True)
        return chat

    def get_chat(self, chat_id: str) -> Optional[Tuple[Chat, List[Message]]]:
        """返回 (chat, messages)；不存在时返回 None。"""
        meta_file = self.chats_dir / f"{chat_id}.json"
        if not meta_file.is_file():
            return None
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        try:
            chat = Chat.model_validate(data)
        except Exception:  # noqa: BLE001
            return None

        messages_dir = self.chats_dir / chat_id
        messages: List[Message] = []
        if messages_dir.is_dir():
            for entry in sorted(messages_dir.iterdir()):
                if entry.is_dir() or not entry.name.endswith(".json"):
                    continue
                try:
                    raw = json.loads(entry.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                if isinstance(raw, dict):
                    try:
                        messages.append(Message.model_validate(raw))
                    except Exception:  # noqa: BLE001
                        continue
        messages.sort(key=lambda m: m.timestamp)
        return chat, messages

    def update_chat(
        self,
        chat_id: str,
        *,
        title: str = "",
        agent_id: str = "",
        agent_session_id: str = "",
    ) -> bool:
        """部分更新会话元数据（title / agent_id / agent_session_id）。成功返回 True。"""
        meta_file = self.chats_dir / f"{chat_id}.json"
        if not meta_file.is_file():
            return False
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return False
        if not isinstance(data, dict):
            return False
        if title:
            data["title"] = title
        if agent_id:
            data["agent_id"] = agent_id
        if agent_session_id:
            data["agent_session_id"] = agent_session_id
        data["updated_at"] = datetime.now().isoformat()
        meta_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return True

    def send_message(
        self,
        chat_id: str,
        *,
        message: str,
        role: str = "user",
        reasoning: str = "",
        todo_card: object = None,
        elapsed: int = 0,
    ) -> Optional[Message]:
        """持久化一条消息（含更新会话元数据）。"""
        messages_dir = self.chats_dir / chat_id
        if not messages_dir.is_dir():
            return None

        role = role or "user"
        now = datetime.now(timezone.utc)
        msg = Message(
            role=role,
            content=message,
            reasoning=reasoning,
            todo_card=todo_card,
            elapsed=elapsed,
            timestamp=now.isoformat(),
        )
        # 文件名格式：YYYYMMDDHHMMSS_<6位微秒>_<role>.json，字典序 = 时间序
        fname = f"{now.strftime('%Y%m%d%H%M%S')}_{now.microsecond:06d}_{role}.json"
        (messages_dir / fname).write_text(
            msg.model_dump_json(), encoding="utf-8"
        )
        if role == "user":
            self._update_chat_meta(chat_id, message)
        return msg

    def delete_chat(self, chat_id: str) -> bool:
        """删除会话元数据 + 消息目录。"""
        meta_file = self.chats_dir / f"{chat_id}.json"
        msgs_dir = self.chats_dir / chat_id
        ok = False
        if meta_file.is_file():
            meta_file.unlink()
            ok = True
        if msgs_dir.is_dir():
            shutil.rmtree(msgs_dir, ignore_errors=True)
            ok = True
        return ok

    # --- private ---

    def _update_chat_meta(self, chat_id: str, message: str) -> None:
        """仅用户消息时：更新 updated_at；若 title 为空，截取 message 前 50 字符。"""
        meta_file = self.chats_dir / f"{chat_id}.json"
        if not meta_file.is_file():
            return
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(data, dict):
            return
        data["updated_at"] = datetime.now().isoformat()
        if not data.get("title") and message:
            data["title"] = message[:50]
        meta_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


__all__ = ["ChatService"]
