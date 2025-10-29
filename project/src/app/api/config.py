from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
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

class ConfigRequest(BaseModel):
    model: Optional[str] = Field(default=None, description="Tên model (vd: gpt-3.5-turbo, gemini-2.5-flash)")
    system_prompt: Optional[str] = Field(default=None, description="System prompt cho model")
    model_parameters: Optional[ModelParameters] = Field(default=None, description="Parameters chi tiết cho model")
    tts_parameters: Optional[TTSParameters] = Field(default=None, description="Parameters cho TTS")

    @validator('model')
    def validate_model(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Model name cannot be empty')
        return v.strip() if v else v

class ConfigResponseFormatted(BaseModel):
    """Formatted response for better user readability"""
    current_configuration: Dict[str, Any]
    available_options: Dict[str, Any]
    quick_templates: Dict[str, Any]
    instructions: Dict[str, Any]

class ConfigResponse(BaseModel):
    model: str
    system_prompt: str
    model_parameters: ModelParameters
    tts_parameters: TTSParameters
    available_models: Dict[str, Any] = {}
    templates: Dict[str, Any] = {}

# Load models from config file
def load_models_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "models.json")
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

models_config = load_models_config()

# In-memory config storage (replace with database in production)
current_config = {
    "model": "gemini-2.5-pro",
    "system_prompt": """Bạn là một chuyên gia phân tích và cố vấn chiến lược báo cáo với 20 năm kinh nghiệm.
Vai trò của bạn:
- Phân tích dữ liệu, thông tin và bối cảnh kinh doanh một cách toàn diện.
- Đưa ra nhận định sắc bén, giải thích rõ ràng và có căn cứ.
- Đề xuất chiến lược báo cáo (cấu trúc, nội dung, insight, KPI, biểu đồ, khuyến nghị) phù hợp với từng tình huống.
- Luôn giải thích *tại sao* chọn phương án đó, không chỉ *làm thế nào*.
- Trình bày chuyên nghiệp, súc tích, ưu tiên tính trực quan và tính thực tiễn.
- Tư duy như một nhà phân tích cấp cao: so sánh, đối chiếu, chỉ ra rủi ro và cơ hội.

Nguyên tắc trả lời:
1. Luôn bắt đầu bằng tóm tắt ngắn gọn ý chính.
2. Sau đó phân tích chi tiết thành các phần (bối cảnh, dữ liệu, insight, khuyến nghị).
3. Kết thúc bằng đề xuất chiến lược hành động hoặc lộ trình cải tiến.

Bạn không được trả lời hời hợt, mọi khuyến nghị đều phải có logic và dẫn chứng.
Mục tiêu cuối cùng: giúp người dùng ra quyết định sáng suốt dựa trên phân tích và báo cáo có hệ thống.""",
    "model_parameters": ModelParameters(temperature=0.3, top_p=0.9, max_tokens=16384),
    "tts_parameters": TTSParameters()
}

# Configuration templates
def get_config_templates():
    return {
        "text_only_basic": {
            "model": "gpt-3.5-turbo",
            "system_prompt": "You are a helpful assistant.",
            "model_parameters": {
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 100
            }
        },
        "text_only_creative": {
            "model": "gpt-4o",
            "system_prompt": "You are a creative writing assistant.",
            "model_parameters": {
                "temperature": 1.2,
                "top_p": 0.95,
                "max_tokens": 500
            }
        },
        "text_only_technical": {
            "model": "gpt-4o",
            "system_prompt": "You are a technical expert and programming assistant.",
            "model_parameters": {
                "temperature": 0.3,
                "top_p": 0.8,
                "max_tokens": 1000
            }
        },
        "tts_only_basic": {
            "tts_parameters": {
                "voice": "alloy",
                "speed": 1.0,
                "provider": "openai"
            }
        },
        "tts_only_expressive": {
            "tts_parameters": {
                "voice": "nova",
                "speed": 1.1,
                "provider": "openai"
            }
        },
        "tts_only_formal": {
            "tts_parameters": {
                "voice": "echo",
                "speed": 0.9,
                "provider": "openai"
            }
        },
        "complete_config": {
            "model": "gpt-3.5-turbo",
            "system_prompt": "You are a helpful assistant.",
            "model_parameters": {
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 100
            },
            "tts_parameters": {
                "voice": "alloy",
                "speed": 1.0,
                "provider": "openai"
            }
        }
    }

@router.post("/", response_model=ConfigResponse)
async def update_config(request: ConfigRequest):
    """Cập nhật cấu hình model và parameters"""
    try:
        global current_config

        # Update config with new values (only if provided)
        if request.model is not None:
            current_config["model"] = request.model

        if request.system_prompt is not None:
            current_config["system_prompt"] = request.system_prompt

        # Update model parameters if provided
        if request.model_parameters:
            current_config["model_parameters"] = request.model_parameters

        # Update TTS parameters if provided
        if request.tts_parameters:
            current_config["tts_parameters"] = request.tts_parameters

        # Import AI service to get available models
        from ..core import ai_service
        available_models = ai_service.get_available_models()

        return ConfigResponse(
            model=current_config["model"],
            system_prompt=current_config["system_prompt"],
            model_parameters=current_config["model_parameters"],
            tts_parameters=current_config["tts_parameters"],
            available_models=available_models,
            templates=get_config_templates()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Config update failed: {str(e)}")

def format_config_for_user():
    """Format configuration data for better user readability"""
    try:
        from ..core import ai_service
        available_models = ai_service.get_available_models()
        
        # Safely handle available_models structure
        if isinstance(available_models, list):
            # If it's a list, convert to expected structure
            available_models = {"text_generation": {"gemini": {}}, "voices": {"openai_voices": [], "google_languages": []}}
        elif not isinstance(available_models, dict):
            # If it's neither list nor dict, create default structure
            available_models = {"text_generation": {"gemini": {}}, "voices": {"openai_voices": [], "google_languages": []}}

        # Safely get nested values with defaults
        gemini_models = available_models.get("text_generation", {}).get("gemini", {})
        if isinstance(gemini_models, dict):
            gemini_model_names = list(gemini_models.keys())
        else:
            gemini_model_names = ["gemini-2.5-pro", "gemini-2.5-flash"]  # Default fallback
            
        openai_voices = available_models.get("voices", {}).get("openai_voices", [])
        if not isinstance(openai_voices, list):
            openai_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]  # Default fallback
            
        google_languages = available_models.get("voices", {}).get("google_languages", [])
        if not isinstance(google_languages, list):
            google_languages = ["en-US", "vi-VN", "fr-FR", "de-DE", "es-ES", "it-IT", "ja-JP", "ko-KR"]  # Default fallback

        return {
            "current_configuration": {
                "📄 Model Being Used": current_config["model"],
                "💬 System Prompt": current_config["system_prompt"][:100] + "..." if len(current_config["system_prompt"]) > 100 else current_config["system_prompt"],
                "🎛️ Text Generation Settings": {
                    "🌡️ Temperature (Creativity)": f"{current_config['model_parameters'].temperature} (0=focused, 2=creative)",
                    "🎯 Top-P (Nucleus Sampling)": f"{current_config['model_parameters'].top_p} (0-1.0)",
                    "📝 Max Tokens": f"{current_config['model_parameters'].max_tokens} tokens"
                },
                "🎵 Text-to-Speech Settings": {
                    "🎤 Voice": current_config["tts_parameters"].voice,
                    "⚡ Speed": f"{current_config['tts_parameters'].speed}x (0.25-4.0)",
                    "🔧 Provider": current_config["tts_parameters"].provider
                }
            },
            "available_options": {
                "📚 Text Generation Models": {
                    "🟢 Google Gemini": gemini_model_names
                },
                "🎵 Text-to-Speech Options": {
                    "🔴 OpenAI Voices": openai_voices,
                    "🟢 Google Languages": google_languages[:8]  # Show first 8
                }
            },
            "quick_templates": {
                "💡 How to Use": "Choose a template below, or create custom settings",
                "📝 Text Only": {
                    "basic": "Simple assistant (temp=0.7, 100 tokens)",
                    "creative": "Creative writing (temp=1.2, 500 tokens)",
                    "technical": "Programming help (temp=0.3, 1000 tokens)"
                },
                "🎵 Speech Only": {
                    "basic": "Standard voice (alloy, 1.0x speed)",
                    "expressive": "Lively voice (nova, 1.1x speed)",
                    "formal": "Professional voice (echo, 0.9x speed)"
                },
                "🎯 Complete Setup": "Full configuration with both text + speech"
            },
            "instructions": {
                "📋 How to Update": {
                    "1️⃣ Change Model": "POST /config/ with {'model': 'gpt-4o'}",
                    "2️⃣ Change Settings": "POST /config/ with {'model_parameters': {...}}",
                    "3️⃣ Change Voice": "POST /config/ with {'tts_parameters': {...}}",
                    "4️⃣ Use Template": "GET /config/templates, then POST the template data"
                },
                "💡 Pro Tips": {
                    "🌡️ Temperature": "Lower = more focused, Higher = more creative",
                    "🎯 Top-P": "0.9 = balanced, 0.8 = focused, 0.95 = diverse",
                    "📝 Tokens": "1 token ≈ 0.75 words in English",
                    "⚡ Speed": "1.0 = normal, 0.5 = slow, 2.0 = fast"
                }
            }
        }
    except Exception as e:
        print(f"Configuration formatting error: {e}")
        # Return a valid structure even on error
        return {
            "current_configuration": {
                "📄 Model Being Used": current_config.get("model", "Unknown"),
                "💬 System Prompt": "Error loading system prompt",
                "🎛️ Text Generation Settings": {
                    "🌡️ Temperature (Creativity)": "Error loading settings",
                    "🎯 Top-P (Nucleus Sampling)": "Error loading settings",
                    "📝 Max Tokens": "Error loading settings"
                },
                "🎵 Text-to-Speech Settings": {
                    "🎤 Voice": "Error loading voice settings",
                    "⚡ Speed": "Error loading speed settings",
                    "🔧 Provider": "Error loading provider settings"
                }
            },
            "available_options": {
                "📚 Text Generation Models": {
                    "🟢 Google Gemini": ["gemini-2.5-pro", "gemini-2.5-flash"]
                },
                "🎵 Text-to-Speech Options": {
                    "🔴 OpenAI Voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
                    "🟢 Google Languages": ["en-US", "vi-VN", "fr-FR", "de-DE"]
                }
            },
            "quick_templates": {
                "💡 How to Use": "Choose a template below, or create custom settings",
                "📝 Text Only": {
                    "basic": "Simple assistant (temp=0.7, 100 tokens)",
                    "creative": "Creative writing (temp=1.2, 500 tokens)",
                    "technical": "Programming help (temp=0.3, 1000 tokens)"
                },
                "🎵 Speech Only": {
                    "basic": "Standard voice (alloy, 1.0x speed)",
                    "expressive": "Lively voice (nova, 1.1x speed)",
                    "formal": "Professional voice (echo, 0.9x speed)"
                },
                "🎯 Complete Setup": "Full configuration with both text + speech"
            },
            "instructions": {
                "📋 How to Update": {
                    "1️⃣ Change Model": "POST /config/ with {'model': 'gpt-4o'}",
                    "2️⃣ Change Settings": "POST /config/ with {'model_parameters': {...}}",
                    "3️⃣ Change Voice": "POST /config/ with {'tts_parameters': {...}}",
                    "4️⃣ Use Template": "GET /config/templates, then POST the template data"
                },
                "💡 Pro Tips": {
                    "🌡️ Temperature": "Lower = more focused, Higher = more creative",
                    "🎯 Top-P": "0.9 = balanced, 0.8 = focused, 0.95 = diverse",
                    "📝 Tokens": "1 token ≈ 0.75 words in English",
                    "⚡ Speed": "1.0 = normal, 0.5 = slow, 2.0 = fast"
                }
            }
        }