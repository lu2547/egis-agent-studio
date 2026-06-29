"""RAG 名称查询服务 —— 与 Go 版 ``service/rag_service.go`` SQL 严格对齐。

数据源：WeKnora 三级知识库重构后的 PG schema（migration 33 后），
表结构与 egis-agent-plugins core 端 ``PostgresClient`` 完全一致。

连接池懒初始化：首次查询时才创建 asyncpg pool，关闭由 app lifespan 负责。
未配置 DB 连接参数时，``is_available`` 为 False，端点应优雅返回空列表。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import asyncpg

from ..config import DatabaseConfig, PathsConfig
from ..models import ChunkDetail, File, KnowledgeBase, KnowledgeChunk, KnowledgeMeta, Tag

logger = logging.getLogger(__name__)


def _record_to_dict(record: asyncpg.Record) -> Dict[str, Any]:
    """将 asyncpg.Record 转换为 dict（保留 SQL AS 别名）。"""
    return dict(record)


class RAGService:
    """RAG 名称查询服务（asyncpg 异步连接池）。"""

    def __init__(self, db_config: DatabaseConfig, paths_config: PathsConfig) -> None:
        self.db_config = db_config
        self.paths_config = paths_config
        self._pool: Optional[asyncpg.Pool] = None

    @property
    def is_available(self) -> bool:
        return self.db_config.is_available

    async def connect(self) -> None:
        """生命周期：创建连接池（仅在 DB 可用时）。"""
        if not self.is_available:
            logger.info("RAG 服务未配置 DB 连接参数，保持不可用")
            return
        try:
            self._pool = await asyncpg.create_pool(
                dsn=self.db_config.dsn(),
                min_size=2,
                max_size=8,
                timeout=5.0,
                command_timeout=10.0,
            )
            logger.info("RAG 服务连接池已建立：%s:%s/%s",
                        self.db_config.host, self.db_config.port, self.db_config.dbname)
        except Exception:
            logger.exception("RAG 服务连接池创建失败")
            self._pool = None

    async def close(self) -> None:
        """生命周期：关闭连接池。"""
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception:  # noqa: BLE001
                logger.warning("RAG 连接池关闭异常")
            finally:
                self._pool = None

    # --- internal ---

    async def _pool_or_none(self) -> Optional[asyncpg.Pool]:
        if self._pool is None and self.is_available:
            await self.connect()
        return self._pool

    # --- 5 个核心查询 ---

    async def list_knowledge_bases(
        self,
        *,
        names: Optional[List[str]] = None,
        ids: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        limit: int = 200,
    ) -> List[KnowledgeBase]:
        """按名称 / ID / 分类精确批量查询知识库（空 = 不过滤）。"""
        pool = await self._pool_or_none()
        if pool is None:
            return []
        if limit <= 0 or limit > 500:
            limit = 200

        conds = ["deleted_at IS NULL"]
        args: List[Any] = []
        if names:
            args.append(names)
            conds.append(f"name = ANY(${len(args)})")
        if ids:
            args.append(ids)
            conds.append(f"id_knowledge_base = ANY(${len(args)})")
        if categories:
            args.append(categories)
            conds.append(f"category = ANY(${len(args)})")

        args.append(limit)
        sql = f"""
            SELECT id_knowledge_base AS id,
                   name,
                   category,
                   COALESCE(owner, '') AS owner,
                   created_at
            FROM knowledge_base
            WHERE {" AND ".join(conds)}
            ORDER BY created_at DESC
            LIMIT ${len(args)}
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
        return [KnowledgeBase.model_validate(_record_to_dict(r)) for r in rows]

    async def list_tags(
        self,
        *,
        names: Optional[List[str]] = None,
        kb_ids: Optional[List[str]] = None,
        limit: int = 500,
    ) -> List[Tag]:
        """按名称 / KB 精确批量查询标签。"""
        pool = await self._pool_or_none()
        if pool is None:
            return []
        if limit <= 0 or limit > 1000:
            limit = 500

        conds = ["deleted_at IS NULL"]
        args: List[Any] = []
        if names:
            args.append(names)
            conds.append(f"name = ANY(${len(args)})")
        if kb_ids:
            args.append(kb_ids)
            conds.append(f"id_knowledge_base = ANY(${len(args)})")

        args.append(limit)
        sql = f"""
            SELECT id_knowledge_tag AS id,
                   name,
                   id_knowledge_base AS knowledge_base_id,
                   COALESCE(owner, '') AS owner,
                   created_at
            FROM knowledge_tag
            WHERE {" AND ".join(conds)}
            ORDER BY created_at DESC
            LIMIT ${len(args)}
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
        return [Tag.model_validate(_record_to_dict(r)) for r in rows]

    async def list_files(
        self,
        *,
        names: Optional[List[str]] = None,
        kb_ids: Optional[List[str]] = None,
        limit: int = 500,
    ) -> List[File]:
        """按文件名（ILIKE 模糊）/ KB 批量查询文档。"""
        pool = await self._pool_or_none()
        if pool is None:
            return []
        if limit <= 0 or limit > 1000:
            limit = 500

        conds = ["deleted_at IS NULL"]
        args: List[Any] = []
        if names:
            # 模糊匹配：任一关键词命中 title 或 file_name 即可
            args.append(names)
            conds.append(
                f"EXISTS (SELECT 1 FROM unnest(${len(args)}::text[]) AS p "
                f"WHERE title ILIKE '%' || p || '%' OR file_name ILIKE '%' || p || '%')"
            )
        if kb_ids:
            args.append(kb_ids)
            conds.append(f"id_knowledge_base = ANY(${len(args)})")

        args.append(limit)
        sql = f"""
            SELECT id_knowledge AS id,
                   title,
                   COALESCE(file_name, '') AS file_name,
                   COALESCE(file_type, '') AS file_type,
                   id_knowledge_base AS knowledge_base_id,
                   COALESCE(tag_id, '') AS tag_id,
                   created_at
            FROM knowledge
            WHERE {" AND ".join(conds)}
            ORDER BY created_at DESC
            LIMIT ${len(args)}
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
        return [File.model_validate(_record_to_dict(r)) for r in rows]

    async def get_chunk(self, chunk_id: str) -> Optional[ChunkDetail]:
        """通过 chunk ID 获取分块详情（供前端引用标签 hover 使用）。"""
        pool = await self._pool_or_none()
        if pool is None:
            return None
        sql = """
            SELECT id_chunk AS id,
                   COALESCE(content, '') AS content,
                   id_knowledge AS knowledge_id,
                   chunk_index
            FROM chunk
            WHERE id_chunk = $1
            LIMIT 1
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(sql, chunk_id)
        if row is None:
            return None
        return ChunkDetail.model_validate(_record_to_dict(row))

    async def list_knowledge_chunks(
        self,
        knowledge_id: str,
        *,
        limit: int = 1000,
    ) -> List[KnowledgeChunk]:
        """加载单篇材料的 chunks，用于引用抽屉完整材料阅读。"""
        pool = await self._pool_or_none()
        if pool is None:
            return []
        if limit <= 0 or limit > 2000:
            limit = 1000
        sql = """
            SELECT id_chunk AS id,
                   COALESCE(content, '') AS content,
                   id_knowledge AS knowledge_id,
                   chunk_index
            FROM chunk
            WHERE id_knowledge = $1
            ORDER BY chunk_index ASC
            LIMIT $2
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, knowledge_id, limit)
        return [KnowledgeChunk.model_validate(_record_to_dict(r)) for r in rows]

    async def get_knowledge_meta(self, knowledge_id: str) -> Optional[KnowledgeMeta]:
        """按 knowledge_id 获取文档元数据（用于文件预览）。"""
        pool = await self._pool_or_none()
        if pool is None:
            return None
        sql = """
            SELECT id_knowledge AS id,
                   title,
                   COALESCE(file_name, '') AS file_name,
                   COALESCE(file_type, '') AS file_type,
                   COALESCE(file_path, '') AS file_path
            FROM knowledge
            WHERE id_knowledge = $1 AND deleted_at IS NULL
            LIMIT 1
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(sql, knowledge_id)
        if row is None:
            return None
        return KnowledgeMeta.model_validate(_record_to_dict(row))

    # --- 路径解析 ---

    def resolve_file_path(self, file_path: str) -> Path:
        """解析 file_path 为本地绝对路径。

        支持三种格式（与 Go ``ResolveFilePath`` 对齐）：
        - ``local://relative/path`` → ``base_dir/relative/path``
        - ``/absolute/path``         → 原样
        - ``relative/path``          → ``base_dir/relative/path``
        """
        base_dir = self.paths_config.knowledge_file_base_dir
        local_scheme = "local://"
        if file_path.startswith(local_scheme):
            return base_dir / file_path[len(local_scheme):]
        p = Path(file_path)
        if p.is_absolute():
            return p
        return base_dir / p


__all__ = ["RAGService"]
