#!/usr/bin/env python3
"""
FoxAI Information API endpoint
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any
import json
import os

router = APIRouter()

class FoxAIInfo(BaseModel):
    name: str
    website: str
    slogan: str
    headquarters: Dict[str, str]
    other_office: Dict[str, str]
    contact: Dict[str, str]
    vision_mission: str
    core_capabilities: List[str]
    target_industries: List[str]
    achievements_metrics: Dict[str, int]
    partners_clients: List[str]
    news_focus: List[str]
    copyright: Dict[str, Any]