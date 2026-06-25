"""EGIS 智能体平台管理界面后端 —— 双模式入口。

模式 1：独立服务（推荐生产部署）
    ``uv run egis-agent-studio`` → 独立 FastAPI 进程（端口 ``STUDIO_BACKEND_PORT``）

模式 2：业务项目按需挂载
    ```python
    # egis-gpt-agents/src/egis_gpt_agents/app.py
    try:
        from egis_agent_studio import build_studio_router
        app.include_router(build_studio_router())
    except ImportError:
        pass
    ```
"""

from __future__ import annotations

from .app import create_studio_app
from .router import build_studio_router

__version__ = "0.1.0"

__all__ = ["build_studio_router", "create_studio_app"]
