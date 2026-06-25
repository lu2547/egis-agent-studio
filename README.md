# egis-agent-studio

EGIS 智能体平台管理界面后端模块。技术栈：Python + FastAPI + asyncpg。

## 架构定位

- **纯模块**：Studio 本身不是一个独立服务，而是被业务 agent 项目（如 `egis-gpt-agents`）作为 Python 模块引入的路由包
- **零代码挂载**：宿主项目只需在 `pyproject.toml` 加 `studio` extra + `.env` 设 `ENABLE_EGIS_STUDIO=true`，`create_app()` 内部按需 try-import 挂载 Studio 路由，业务代码一行不改
- **宿主进程统一管理配置**：Studio 没有独立 `.env`，所有环境变量（`AGENTS_DIR` / `CORE_SKILLS_DIR` / `DB_*` / `STUDIO_DATA_DIR`）由宿主业务项目提供
- **前端零改动**：API 路径与响应格式与旧 Go 版完全对齐

## 目录结构

```
egis-agent-studio/
├── backend.go/                      # 旧 Go 后端归档（仅作参考）
├── frontend/                        # Vue + Vite 前端（独立 dev server）
├── data/                            # chats/*.json 持久化目录
├── scripts/                         # 辅助脚本（如 clear_chats.sh）
├── pyproject.toml                   # Python 包定义（无 console_script）
├── .env.example                     # 环境变量说明（Studio 无独立 .env）
└── src/egis_agent_studio/
    ├── __init__.py                  # 包入口（导出 build_studio_router / create_studio_app）
    ├── app.py                       # create_studio_app() 独立工厂（供业务项目参考调用）
    ├── config.py                    # 配置读取（从宿主进程环境变量）
    ├── models.py                    # Pydantic schemas
    ├── router.py                    # 路由装配
    └── services/
        ├── agent_service.py         # 扫描 agents/ 目录
        ├── chat_service.py          # JSON 持久化
        └── rag_service.py           # asyncpg PG 查询
```

## 环境变量（由宿主业务项目 .env 提供）

| 变量              | 必填   | 说明                                                    |
| ----------------- | ------ | ------------------------------------------------------- |
| `AGENTS_DIR`      | **是** | 业务项目的 `agents/` 目录绝对路径                       |
| `CORE_SKILLS_DIR` | **是** | `egis-agent-plugins` 的 `core/skills/` 目录             |
| `STUDIO_DATA_DIR` | 否     | chat 持久化根目录（默认 `./data`）                      |
| `DB_*`            | ◐      | RAG 名称查询所需的 PostgreSQL 连接（空 = 该能力不可用） |

## 启动

Studio 没有自己的启动命令。宿主业务项目（如 `egis-gpt-agents`）只需：

**1) pyproject.toml** —— 声明 `studio` extra + path source：

```toml
# egis-gpt-agents/pyproject.toml
[project.optional-dependencies]
studio = ["egis-agent-studio"]

[tool.uv.sources]
egis-agent-studio = { path = "../egis-agent-studio", editable = true }
```

**2) .env** —— 打开挂载开关 + 提供路径变量：

```bash
ENABLE_EGIS_STUDIO=true
AGENTS_DIR=/path/to/.../agents
CORE_SKILLS_DIR=/path/to/.../core/skills
STUDIO_DATA_DIR=/path/to/studio/data
DB_HOST=... / DB_PORT=... / DB_USER=... / DB_PASSWORD=... / DB_NAME=... / DB_SSLMODE=...
```

**3) 构建前端**（可选，构建后后端自动托管 SPA）：

```bash
cd egis-agent-studio/frontend
npm install && npm run build   # 生成 frontend/dist/
```

构建产物（`frontend/dist/`）存在时，后端启动时自动 `app.mount("/", StaticFiles(html=True))`，访问 `http://localhost:38081/` 直接返回前端页面，无需 nginx 或单独静态服务。

**4) 启动** —— `create_app()`（来自 `egis_agent_plugins.core.bootstrap`）会读取 `ENABLE_EGIS_STUDIO`，自动 try-import `egis_agent_studio` 并 `include_router(build_studio_router())`，同时负责 RAGService 的 asyncpg 连接池生命周期：

```bash
cd egis-gpt-agents
uv sync --all-extras
uv run egis-gpt-agents
# → http://0.0.0.0:38081/             ← 前端 SPA（dist 存在时）
# → http://0.0.0.0:38081/api/agents
# → http://0.0.0.0:38081/api/studio/chats
# → http://0.0.0.0:38081/api/rag/knowledge_bases
```

不装 `studio` extra 或不开 `ENABLE_EGIS_STUDIO` 时，import 静默失败，业务项目干净启动。

**dev 模式**（前端热更新）：

```bash
cd egis-agent-studio/frontend && npm run dev
# vite dev server :30080，所有 /api/* 代理到宿主 :38081
```

## API 端点

### Agent 元数据
- `GET /api/agents` — 列出所有 agent
- `GET /api/agents/:id/skills` — agent 的 skills（agent 专属 + core 全局）
- `GET /api/agents/:id/tools` — agent 依赖的 tools

### Chat 持久化
- `GET    /api/studio/chats`           — 列出会话（按 updated_at 倒序）
- `POST   /api/studio/chats`           — 新建会话 `{agent_id, title}`
- `GET    /api/studio/chats/:id`       — 会话详情 + 消息列表
- `PUT    /api/studio/chats/:id`       — 更新 `{title, agent_id, agent_session_id}`
- `POST   /api/studio/chats/:id/messages` — 追加消息
- `DELETE /api/studio/chats/:id`       — 删除会话

### RAG 名称查询
- `GET /api/rag/knowledge_bases` — query: `names,ids,categories,limit`
- `GET /api/rag/tags`            — query: `names,kb_ids,limit`
- `GET /api/rag/files`           — query: `names,kb_ids,limit`（ILIKE 模糊）
- `GET /api/rag/chunks/:id`      — 分块详情
- `GET /api/rag/knowledge/:id/preview` — 文档原始文件流（PDF/Markdown/图片）

## 与旧 Go 版的兼容性

- **API 路径 100% 对齐**：前端零改动
- **响应格式 100% 对齐**：`{"agents": [...]}` / `{"chats": [...]}` / `{"items": [...], "count": N}`
- **旧代码保留**：`backend.go/` 作为参照，不删
- **`backend.go/` 已不参与构建**：`pyproject.toml` 只 include `src/egis_agent_studio/`

## 约束

- **ark-agentic 不可修改**：Studio 与 ark 零源码耦合，只通过业务项目暴露的 `/api/v1/chat/*` HTTP 接口交互
- **按需引入不污染**：`build_studio_router()` 不依赖业务项目的任何模块
- **DB 未配时优雅降级**：RAG 端点返回空列表而非 500
