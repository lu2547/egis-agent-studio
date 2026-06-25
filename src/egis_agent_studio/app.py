"""Studio 应用工厂 + 静态文件挂载。

模块对外暴露两个函数：

- ``create_studio_app()``：构建完整装配的 FastAPI 应用（供宿主业务项目参考）
- ``mount_static(app)``：检测 ``frontend/dist/``，若存在则挂载为静态文件（供宿主或独立工厂调用）

挂载逻辑：检测本包同级 ``frontend/dist/index.html``，存在时把整个 ``dist/``
作为静态资源挂载到 ``/``，未命中 API 路径的请求回退到 ``index.html``（SPA 路由兼容）。
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import StudioConfig
from .router import build_studio_router
from .services.agent_service import AgentService
from .services.chat_service import ChatService
from .services.rag_service import RAGService

logger = logging.getLogger(__name__)


# 前端构建产物目录：
# - whl:     egis_agent_studio/frontend/dist/
# - editable: 项目根 frontend/dist/
_PACKAGE_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _PACKAGE_DIR.parent.parent
_PACKAGED_FRONTEND_DIST_DIR = _PACKAGE_DIR / "frontend" / "dist"
_EDITABLE_FRONTEND_DIST_DIR = _PROJECT_DIR / "frontend" / "dist"


def get_frontend_dist_dir() -> Path:
    if (_EDITABLE_FRONTEND_DIST_DIR / "index.html").is_file():
        return _EDITABLE_FRONTEND_DIST_DIR
    return _PACKAGED_FRONTEND_DIST_DIR


def _resolve_cors_origins() -> tuple[list[str], bool]:
    """解析 ``CORS_ALLOW_ORIGINS`` 环境变量。``"*"`` 时不允许 credentials。"""
    raw = os.getenv("CORS_ALLOW_ORIGINS", "*").strip()
    origins = ["*"] if raw == "*" else [o.strip() for o in raw.split(",") if o.strip()]
    allow_credentials = origins != ["*"]
    return origins, allow_credentials


def mount_static(app: FastAPI) -> bool:
    """挂载前端构建产物（如存在）。

    成功挂载返回 True；``frontend/dist/`` 不存在则跳过（dev 环境 vite dev server 接管）。
    """
    frontend_dist_dir = get_frontend_dist_dir()
    if not (frontend_dist_dir / "index.html").is_file():
        logger.info(
            "frontend/dist 未构建，跳过静态挂载（dev 下由 vite dev server 提供）"
        )
        return False
    try:
        from fastapi.staticfiles import StaticFiles

        app.mount(
            "/",
            StaticFiles(directory=str(frontend_dist_dir), html=True),
            name="studio-frontend",
        )
        logger.info("Studio 前端已挂载：dist=%s", frontend_dist_dir)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Studio 前端挂载失败：%s", exc)
        return False


def create_studio_app() -> FastAPI:
    """构建并返回完整装配的 Studio FastAPI 应用。"""
    # 加载 .env（若存在）—— 生产环境也可直接通过环境变量注入
    load_dotenv()

    config = StudioConfig.load()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # 启动：建立 chats 目录 + RAG 连接池
        config.paths.studio_data_dir.mkdir(parents=True, exist_ok=True)
        (config.paths.studio_data_dir / "chats").mkdir(parents=True, exist_ok=True)
        rag_svc: RAGService = app.state.rag_service
        await rag_svc.connect()
        logger.info(
            "Studio starting — port=%s agents_dir=%s",
            config.server.port,
            config.paths.agents_base_dir,
        )
        try:
            yield
        finally:
            # 关闭：释放 asyncpg pool
            await rag_svc.close()
            logger.info("Studio shutdown complete")

    app = FastAPI(
        title="egis-agent-studio",
        description="EGIS 智能体平台管理界面（agents / chats / RAG 名称查询）",
        version="0.1.0",
        lifespan=lifespan,
    )

    # 三个服务单例挂到 app.state，供 router 通过 Request 取用
    app.state.agent_service = AgentService(
        agents_base_dir=config.paths.agents_base_dir,
        core_skills_dir=config.paths.core_skills_dir,
    )
    app.state.chat_service = ChatService(data_dir=config.paths.studio_data_dir)
    app.state.rag_service = RAGService(
        db_config=config.db,
        paths_config=config.paths,
    )

    # CORS
    origins, allow_credentials = _resolve_cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 路由
    app.include_router(build_studio_router())

    # 静态前端（必须放在所有路由之后，mount "/" 会捕获未命中路径）
    mount_static(app)
    return app


__all__ = ["create_studio_app", "get_frontend_dist_dir", "mount_static"]
