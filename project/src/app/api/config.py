from fastapi import APIRouter
from typing import Optional
from pydantic import BaseModel, Field
import json
import os

router = APIRouter(prefix="/config", tags=["Configuration"])

class ModelParameters(BaseModel):
    """Chi tiết parameters cho model"""
    temperature: Optional[float] = Field(default=0.3, ge=0.0, le=2.0, description="Độ sáng tạo (0.0-2.0)")
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0, description="Top-p sampling (0.0-1.0)")
    max_tokens: Optional[int] = Field(default=16384, ge=1, le=65536, description="Số token tối đa")

class TTSParameters(BaseModel):
    """Chi tiết parameters cho TTS"""
    voice: Optional[str] = Field(default="alloy", description="Giọng đọc")
    speed: Optional[float] = Field(default=1.0, ge=0.25, le=4.0, description="Tốc độ đọc (0.25-4.0)")
    provider: Optional[str] = Field(default="openai", description="Provider TTS (openai, google, gemini)")

class ConfigResponse(BaseModel):
    model: str
    system_prompt: str
    model_parameters: ModelParameters
    tts_parameters: TTSParameters

# Load models from config file
def load_models_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "models.json")
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

models_config = load_models_config()

# Load hardcoded configuration from models.json
def load_hardcoded_config():
    """Load config từ models.json - config cứng cho AI Chat"""
    model_name = "gemini-2.5-pro"
    
    # Get model parameters from models.json
    model_config = models_config.get("text_generation", {}).get("gemini", {}).get(model_name, {})
    
    # Get system prompt from models.json
    system_prompt = models_config.get("system_prompts", {}).get("default", {}).get("text_generation", "")
    
    return {
        "model": model_name,
        "system_prompt": system_prompt,
        "model_parameters": ModelParameters(
            temperature=model_config.get("temperature", 1.0),
            top_p=model_config.get("top_p", 0.95),
            max_tokens=model_config.get("max_output_tokens", 8192)
        ),
        "tts_parameters": TTSParameters()
    }

# In-memory config storage - loaded from models.json
current_config = load_hardcoded_config()

@router.get("/", response_model=ConfigResponse)
async def get_config():
    """Lấy cấu hình hiện tại"""
    return ConfigResponse(
        model=current_config["model"],
        system_prompt=current_config["system_prompt"],
        model_parameters=current_config["model_parameters"],
        tts_parameters=current_config["tts_parameters"]
    )