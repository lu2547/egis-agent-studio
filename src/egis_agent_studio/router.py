"""FastAPI 路由装配 —— 与 Go 版 ``router/router.go`` 路径严格对齐。

三个子 Router：
- ``/api/agents``   (3 endpoint)
- ``/api/studio``   (6 endpoint，含 chats)
- ``/api/rag``      (5 endpoint)

服务实例通过 ``app.state`` 共享，``_services`` 辅助函数取用。
"""

from __future__ import annotations

import logging
import mimetypes
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse

from .models import (
    Chat,
    CreateChatRequest,
    Message,
    SendMessageRequest,
    UpdateChatRequest,
)
from .services.agent_service import AgentService
from .services.chat_service import ChatService
from .services.rag_service import RAGService

logger = logging.getLogger(__name__)


# --- 依赖注入 ---


def _services(request: Request):
    """从 app.state 取三个服务单例。"""
    return (
        request.app.state.agent_service,
        request.app.state.chat_service,
        request.app.state.rag_service,
    )


# --- 工具函数 ---


def _split_csv(value: str) -> List[str]:
    """将逗号分隔的 query string 解析为去空白后的字符串列表。"""
    if not value:
        return []
    return [p.strip() for p in value.split(",") if p.strip()]


def _parse_limit(value: Optional[int], fallback: int) -> int:
    if value is None or value <= 0:
        return fallback
    return value


# --- 子 Router ---


def _build_agents_router() -> APIRouter:
    router = APIRouter(prefix="/api/agents", tags=["agents"])

    @router.get("")
    async def list_agents(deps=Depends(_services)):
        agent_svc: AgentService = deps[0]
        return {"agents": agent_svc.list_agents()}

    @router.get("/{agent_id}/skills")
    async def get_skills(agent_id: str, deps=Depends(_services)):
        agent_svc: AgentService = deps[0]
        return {"skills": agent_svc.get_skills(agent_id)}

    @router.get("/{agent_id}/tools")
    async def get_tools(agent_id: str, deps=Depends(_services)):
        agent_svc: AgentService = deps[0]
        return {"tools": agent_svc.get_tools(agent_id)}

    return router


def _build_chat_router() -> APIRouter:
    router = APIRouter(prefix="/api/studio", tags=["chats"])

    @router.get("/chats")
    async def list_chats(deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        return {"chats": chat_svc.list_chats()}

    @router.post("/chats")
    async def create_chat(req: CreateChatRequest, deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        return chat_svc.create_chat(agent_id=req.agent_id, title=req.title)

    @router.get("/chats/{chat_id}")
    async def get_chat(chat_id: str, deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        result = chat_svc.get_chat(chat_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        chat, messages = result
        return {"chat": chat, "messages": messages}

    @router.put("/chats/{chat_id}")
    async def update_chat(chat_id: str, req: UpdateChatRequest, deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        ok = chat_svc.update_chat(
            chat_id,
            title=req.title,
            agent_id=req.agent_id,
            agent_session_id=req.agent_session_id,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"status": "updated"}

    @router.post("/chats/{chat_id}/messages")
    async def send_message(chat_id: str, req: SendMessageRequest, deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        msg = chat_svc.send_message(
            chat_id,
            message=req.message,
            role=req.role,
            reasoning=req.reasoning,
            todo_card=req.todo_card,
            elapsed=req.elapsed,
        )
        if msg is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        return msg

    @router.delete("/chats/{chat_id}")
    async def delete_chat(chat_id: str, deps=Depends(_services)):
        chat_svc: ChatService = deps[1]
        chat_svc.delete_chat(chat_id)
        return {"status": "deleted"}

    return router


def _build_rag_router() -> APIRouter:
    router = APIRouter(prefix="/api/rag", tags=["rag"])

    @router.get("/knowledge_bases")
    async def list_knowledge_bases(
        names: str = Query(default="", description="逗号分隔的名称"),
        ids: str = Query(default="", description="KB ID 列表"),
        categories: str = Query(default="", description="分类过滤"),
        limit: Optional[int] = Query(default=200),
        deps=Depends(_services),
    ):
        rag_svc: RAGService = deps[2]
        items = await rag_svc.list_knowledge_bases(
            names=_split_csv(names),
            ids=_split_csv(ids),
            categories=_split_csv(categories),
            limit=_parse_limit(limit, 200),
        )
        return {"items": items, "count": len(items)}

    @router.get("/tags")
    async def list_tags(
        names: str = Query(default=""),
        kb_ids: str = Query(default=""),
        limit: Optional[int] = Query(default=500),
        deps=Depends(_services),
    ):
        rag_svc: RAGService = deps[2]
        items = await rag_svc.list_tags(
            names=_split_csv(names),
            kb_ids=_split_csv(kb_ids),
            limit=_parse_limit(limit, 500),
        )
        return {"items": items, "count": len(items)}

    @router.get("/files")
    async def list_files(
        names: str = Query(default=""),
        kb_ids: str = Query(default=""),
        limit: Optional[int] = Query(default=500),
        deps=Depends(_services),
    ):
        rag_svc: RAGService = deps[2]
        items = await rag_svc.list_files(
            names=_split_csv(names),
            kb_ids=_split_csv(kb_ids),
            limit=_parse_limit(limit, 500),
        )
        return {"items": items, "count": len(items)}

    @router.get("/chunks/{chunk_id}")
    async def get_chunk(chunk_id: str, deps=Depends(_services)):
        rag_svc: RAGService = deps[2]
        if not chunk_id:
            raise HTTPException(status_code=400, detail="chunk id is required")
        chunk = await rag_svc.get_chunk(chunk_id)
        if chunk is None:
            logger.warning("[RAG Chunk] chunk not found chunk_id=%s", chunk_id)
            raise HTTPException(status_code=404, detail="chunk not found")
        if not chunk.content:
            logger.warning(
                "[RAG Chunk] empty content chunk_id=%s knowledge_id=%s chunk_index=%s",
                chunk.id,
                chunk.knowledge_id,
                chunk.chunk_index,
            )
        return {"data": chunk}

    @router.get("/knowledge/{knowledge_id}/chunks")
    async def list_knowledge_chunks(
        knowledge_id: str,
        limit: Optional[int] = Query(default=1000),
        deps=Depends(_services),
    ):
        rag_svc: RAGService = deps[2]
        if not knowledge_id:
            raise HTTPException(status_code=400, detail="knowledge id is required")
        chunks = await rag_svc.list_knowledge_chunks(
            knowledge_id,
            limit=_parse_limit(limit, 1000),
        )
        if not chunks:
            logger.warning("[RAG Chunks] no chunks knowledge_id=%s", knowledge_id)
        return {"items": chunks, "count": len(chunks)}

    @router.get("/knowledge/{knowledge_id}/preview")
    async def preview_knowledge(knowledge_id: str, deps=Depends(_services)):
        """返回文档原始文件流（PDF/Markdown/图片等），供前端抽屉 iframe 内嵌预览。"""
        rag_svc: RAGService = deps[2]
        if not knowledge_id:
            raise HTTPException(status_code=400, detail="knowledge id is required")
        meta = await rag_svc.get_knowledge_meta(knowledge_id)
        if meta is None:
            raise HTTPException(status_code=404, detail="knowledge not found")
        if not meta.file_path:
            raise HTTPException(status_code=404, detail="file path is empty")
        resolved = rag_svc.resolve_file_path(meta.file_path)
        if not resolved.is_file():
            logger.warning(
                "[RAG Preview] file not accessible knowledge_id=%s path=%s",
                knowledge_id,
                resolved,
            )
            raise HTTPException(
                status_code=404,
                detail="原始文件暂不可预览，请查看引用片段内容",
            )
        media_type = mimetypes.guess_type(meta.file_name)[0] or "application/octet-stream"
        if media_type in {
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }:
            raise HTTPException(
                status_code=415,
                detail="该文件类型不支持内嵌预览，请查看引用片段内容",
            )
        return FileResponse(
            path=str(resolved),
            media_type=media_type,
            headers={
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": f'inline; filename="{meta.file_name}"',
            },
        )

    return router


# --- 公共入口 ---


def build_studio_router() -> APIRouter:
    """构建完整的 Studio 路由树，可被业务项目通过 ``include_router`` 按需挂载。"""
    root = APIRouter()
    root.include_router(_build_agents_router())
    root.include_router(_build_chat_router())
    root.include_router(_build_rag_router())
    return root


__all__ = ["build_studio_router"]
