"""Agent 元数据服务 —— 扫描本地 agents/ 与 core/skills/ 目录，返回结构化元数据。

与 Go 版 ``service/agent_service.go`` 行为严格对齐：
- ``list_agents``   → 扫描 ``AGENTS_DIR/<agent_id>/agent.json``
- ``get_skills``    → 合并 agent 专属 ``skills/`` + core ``CORE_SKILLS_DIR/``
- ``get_tools``     → 优先 ``agent.json.tools`` 字段，空时回退扫 ``tools/<name>/tool.json``
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional

from ..models import Agent, Skill, Tool

logger = logging.getLogger(__name__)


class AgentService:
    """Agent 元数据服务（纯文件 IO，无外部依赖）。"""

    def __init__(self, agents_base_dir: Path, core_skills_dir: Path) -> None:
        self.agents_base_dir = agents_base_dir
        self.core_skills_dir = core_skills_dir

    # --- public ---

    def list_agents(self) -> List[Agent]:
        """扫描 ``AGENTS_DIR`` 下所有 ``<agent_id>/agent.json`` 返回 Agent 列表。"""
        if not self.agents_base_dir.is_dir():
            logger.warning("AGENTS_DIR 不存在：%s", self.agents_base_dir)
            return []

        agents: List[Agent] = []
        for entry in sorted(self.agents_base_dir.iterdir()):
            if not entry.is_dir():
                continue
            agent_file = entry / "agent.json"
            if not agent_file.is_file():
                continue
            try:
                data = json.loads(agent_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("解析 %s 失败：%s", agent_file, exc)
                continue
            if not isinstance(data, dict):
                continue
            agents.append(Agent.model_validate(data))
        return agents

    def get_skills(self, agent_id: str) -> List[Skill]:
        """合并 agent 专属 skills + core 全局 skills。"""
        skills: List[Skill] = []
        agent_skills_dir = self.agents_base_dir / agent_id / "skills"
        skills.extend(self._scan_skills(agent_skills_dir, source="agent"))
        skills.extend(self._scan_skills(self.core_skills_dir, source="core"))
        return skills

    def get_tools(self, agent_id: str) -> List[Tool]:
        """优先 ``agent.json.tools``，空时回退扫 ``tools/<name>/tool.json``。"""
        tools_from_json = self._read_tools_from_agent_json(agent_id)
        if tools_from_json is not None:
            return tools_from_json
        tools_dir = self.agents_base_dir / agent_id / "tools"
        return self._scan_tools(tools_dir)

    # --- private ---

    def _read_tools_from_agent_json(self, agent_id: str) -> Optional[List[Tool]]:
        """读取 ``agent.json.tools`` 字段（工具名列表）。返回 None 表示无此声明。"""
        agent_file = self.agents_base_dir / agent_id / "agent.json"
        if not agent_file.is_file():
            return None
        try:
            data = json.loads(agent_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(data, dict):
            return None
        raw_tools = data.get("tools")
        if not raw_tools:
            return None
        tools: List[Tool] = []
        for name in raw_tools:
            if not isinstance(name, str):
                continue
            name = name.strip()
            if name:
                tools.append(Tool(name=name))
        return tools

    def _scan_skills(self, skills_dir: Path, source: str) -> List[Skill]:
        """扫描 ``<skills_dir>/<skill_name>/SKILL.md``。"""
        if not skills_dir.is_dir():
            return []
        skills: List[Skill] = []
        for entry in sorted(skills_dir.iterdir()):
            if not entry.is_dir():
                continue
            skill_file = entry / "SKILL.md"
            skill = Skill(name=entry.name, source=source)
            if skill_file.is_file():
                try:
                    content = skill_file.read_text(encoding="utf-8")
                except OSError:
                    content = ""
                skill.content = content
                # Go 版按 "\n" SplitN(3)：lines[0] 通常是标题，lines[1] 取作描述。
                lines = content.split("\n", 2)
                if len(lines) > 1:
                    skill.description = lines[1].strip()
            skills.append(skill)
        return skills

    def _scan_tools(self, tools_dir: Path) -> List[Tool]:
        """扫描 ``<tools_dir>/<tool_name>/tool.json``。"""
        if not tools_dir.is_dir():
            return []
        tools: List[Tool] = []
        for entry in sorted(tools_dir.iterdir()):
            if not entry.is_dir():
                continue
            tool_file = entry / "tool.json"
            tool = Tool(name=entry.name)
            if tool_file.is_file():
                try:
                    data = json.loads(tool_file.read_text(encoding="utf-8"))
                    if isinstance(data, dict):
                        tool = Tool.model_validate(data)
                        if not tool.name:
                            tool.name = entry.name
                except (OSError, json.JSONDecodeError):
                    pass
            tools.append(tool)
        return tools


__all__ = ["AgentService"]
