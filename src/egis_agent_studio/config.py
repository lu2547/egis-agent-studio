"""配置 —— 从环境变量读取，与旧 Go 版 DefaultConfig() 对齐。

环境变量：
    STUDIO_BACKEND_PORT  监听端口（默认 8081；生产建议 30081）
    AGENTS_DIR           业务项目 agents/ 目录绝对路径（必填）
    CORE_SKILLS_DIR      plugins core/skills/ 目录绝对路径（必填）
    STUDIO_DATA_DIR      Studio 数据目录，chats 会落到其下 chats/（默认 ./data）
    KNOWLEDGE_FILE_BASE_DIR  知识库文件本地存储根目录（默认 ./data/files）

    DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / DB_SSLMODE
                         RAG 名称查询所需的 PostgreSQL 连接参数。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


class StudioConfigError(RuntimeError):
    """启动期必需环境变量未提供。"""


def _getenv(key: str, default: str = "") -> str:
    v = os.getenv(key, default)
    return v.strip() if isinstance(default, str) else v


def _must_getenv(key: str) -> str:
    v = os.getenv(key, "").strip()
    if not v:
        raise StudioConfigError(
            f"环境变量 {key} 未配置：Studio 不耐耦具体业务 agent 项目，请在 .env 中显式指定。"
        )
    return v


@dataclass(frozen=True)
class ServerConfig:
    port: str = field(default="8081")

    @classmethod
    def from_env(cls) -> "ServerConfig":
        port = _getenv("STUDIO_BACKEND_PORT", "8081")
        return cls(port=port)


@dataclass(frozen=True)
class PathsConfig:
    agents_base_dir: Path = field(default_factory=lambda: Path("."))
    core_skills_dir: Path = field(default_factory=lambda: Path("."))
    studio_data_dir: Path = field(default_factory=lambda: Path("./data"))
    knowledge_file_base_dir: Path = field(default_factory=lambda: Path("./data/files"))

    @classmethod
    def from_env(cls) -> "PathsConfig":
        agents_base_dir = Path(_must_getenv("AGENTS_DIR"))
        core_skills_dir = Path(_must_getenv("CORE_SKILLS_DIR"))
        studio_data_dir = Path(_getenv("STUDIO_DATA_DIR", "./data"))
        knowledge_file_base_dir = Path(_getenv("KNOWLEDGE_FILE_BASE_DIR", "./data/files"))
        return cls(
            agents_base_dir=agents_base_dir,
            core_skills_dir=core_skills_dir,
            studio_data_dir=studio_data_dir,
            knowledge_file_base_dir=knowledge_file_base_dir,
        )


@dataclass(frozen=True)
class DatabaseConfig:
    host: str = "localhost"
    port: int = 5432
    user: str = ""
    password: str = ""
    dbname: str = ""
    sslmode: str = "disable"

    @classmethod
    def from_env(cls) -> "DatabaseConfig":
        host = _getenv("DB_HOST", "localhost")
        port_raw = _getenv("DB_PORT", "5432")
        try:
            port = int(port_raw)
        except ValueError:
            port = 5432
        return cls(
            host=host,
            port=port,
            user=_getenv("DB_USER"),
            password=_getenv("DB_PASSWORD"),
            dbname=_getenv("DB_NAME"),
            sslmode=_getenv("DB_SSLMODE", "disable"),
        )

    @property
    def is_available(self) -> bool:
        """用户与数据库名必须同时非空才能建立连接。"""
        return bool(self.user) and bool(self.dbname)

    def dsn(self) -> str:
        return (
            f"postgres://{self.user}:{self.password}@{self.host}:{self.port}/{self.dbname}"
            f"?sslmode={self.sslmode}"
        )


@dataclass(frozen=True)
class StudioConfig:
    server: ServerConfig = field(default_factory=ServerConfig.from_env)
    paths: PathsConfig = field(default_factory=PathsConfig.from_env)
    db: DatabaseConfig = field(default_factory=DatabaseConfig.from_env)

    @classmethod
    def load(cls) -> "StudioConfig":
        """读取当前环境变量构造配置。"""
        return cls(
            server=ServerConfig.from_env(),
            paths=PathsConfig.from_env(),
            db=DatabaseConfig.from_env(),
        )


__all__ = [
    "StudioConfig",
    "StudioConfigError",
    "ServerConfig",
    "PathsConfig",
    "DatabaseConfig",
]
