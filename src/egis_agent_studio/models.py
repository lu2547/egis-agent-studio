"""Pydantic schemas —— 与 Go 版 model.go 字段严格对齐，确保前端零改动。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


# --- Agent / Skill / Tool ---


class Agent(BaseModel):
    """Agent 元数据（直接读取 agent.json）。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    name: str = ""
    description: str = ""
    status: str = ""
    created_at: str = ""
    updated_at: str = ""


class Skill(BaseModel):
    """Skill 元数据（扫描 SKILL.md 解析）。"""

    name: str
    description: str = ""
    content: str = ""
    source: str = ""  # "agent" | "core"


class Tool(BaseModel):
    """Tool 元数据（agent.json.tools 字段 或 tool.json）。"""

    name: str
    description: str = ""
    parameters: Optional[List[Any]] = None


# --- Chat / Message ---


class Chat(BaseModel):
    """对话会话元数据（持久化到 chats/<id>.json）。"""

    id: str
    title: str = ""
    agent_id: str = ""
    agent_session_id: str = ""
    created_at: datetime
    updated_at: datetime


class Message(BaseModel):
    """对话消息（AGUI minimal 模式）。"""

    role: str
    content: str
    reasoning: str = ""
    todo_card: Optional[Any] = None
    elapsed: int = 0
    timestamp: str


# --- RAG ---


class KnowledgeBase(BaseModel):
    """知识库元数据（精简）。"""

    id: str
    name: str
    category: str
    owner: str = ""
    created_at: datetime


class Tag(BaseModel):
    """标签元数据（精简）。"""

    id: str
    name: str
    knowledge_base_id: str
    owner: str = ""
    created_at: datetime


class File(BaseModel):
    """文档/文件元数据（精简）。"""

    id: str
    title: str
    file_name: str = ""
    file_type: str = ""
    knowledge_base_id: str
    tag_id: str = ""
    created_at: datetime


class ChunkDetail(BaseModel):
    """分块详情（供前端引用标签 hover 浮层使用）。"""

    id: str
    content: str
    knowledge_id: str
    chunk_index: int


class KnowledgeChunk(BaseModel):
    """文档内分块（用于引用材料阅读器）。"""

    id: str
    content: str
    knowledge_id: str
    chunk_index: int


class KnowledgeMeta(BaseModel):
    """文档元数据（用于文件预览）。"""

    id: str
    title: str
    file_name: str = ""
    file_type: str = ""
    file_path: str = ""


# --- Request DTOs ---


class CreateChatRequest(BaseModel):
    agent_id: str
    title: str = ""


class UpdateChatRequest(BaseModel):
    title: str = ""
    agent_id: str = ""
    agent_session_id: str = ""


class SendMessageRequest(BaseModel):
    message: str
    role: str = "user"
    reasoning: str = ""
    todo_card: Optional[Any] = None
    elapsed: int = 0


__all__ = [
    "Agent",
    "Skill",
    "Tool",
    "Chat",
    "Message",
    "KnowledgeBase",
    "Tag",
    "File",
    "ChunkDetail",
    "KnowledgeMeta",
    "CreateChatRequest",
    "UpdateChatRequest",
    "SendMessageRequest",
]
