import anthropic
from app.config.settings import settings
from typing import List, Dict, Optional, Any


class ClaudeService:
    """Service for interacting with Claude API"""
    
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=settings.claude.api_key,
            timeout=600.0,  # 10 minutes timeout
        )
    
    async def send_message(
        self,
        messages: List[Dict[str, Any]],
        model: str = "claude-sonnet-4-5-20250929",
        max_tokens: int = 40000,
        temperature: float = 1.0,
        system: Optional[str] = None,
        thinking_enabled: bool = False,
        thinking_budget_tokens: int = 1024
    ) -> Dict[str, Any]:
        """
        Send message to Claude API
        
        Args:
            messages: List of message objects with role and content
            model: Claude model to use
            max_tokens: Maximum tokens in response
            temperature: Temperature for response generation
            system: System prompt
            thinking_enabled: Enable extended thinking
            thinking_budget_tokens: Budget for thinking tokens
            
        Returns:
            Response from Claude API
        """
        request_params = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        
        if system:
            request_params["system"] = system
            
        if thinking_enabled:
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget_tokens
            }
        
        response = self.client.messages.create(**request_params)
        
        return {
            "id": response.id,
            "model": response.model,
            "role": response.role,
            "content": [
                {
                    "type": block.type,
                    "text": block.text if hasattr(block, 'text') else None
                }
                for block in response.content
            ],
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        }
    
    async def send_simple_message(
        self,
        user_message: str,
        model: str = "claude-sonnet-4-5-20250929",
        max_tokens: int = 30000,
        system: Optional[str] = None,
        max_slides: int = 5
    ) -> str:
        """
        Send simple text message to Claude
        
        Args:
            user_message: User's message text
            model: Claude model to use
            max_tokens: Maximum tokens in response
            system: System prompt (defaults to HTML slide generation prompt)
            
        Returns:
            Text response from Claude
        """
        # Default system prompt for HTML slide generation
        if system is None:
            system = f"""Phân tích file và tạo {max_slides} slides HTML báo cáo. Mỗi slide kết hợp số liệu, biểu đồ và text.

QUY TẮC:
- Đúng {max_slides} slides, không thêm không bớt
- Mỗi slide: tiêu đề + biểu đồ Chart.js + KPI numbers + bullet points insight
- Chọn chart type phù hợp data: Line (xu hướng), Bar (so sánh), Pie (tỷ lệ), Combo
- Layout tự do, không bắt buộc format cứng
- Màu sắc professional, không quá màu mè
- KHÔNG tạo slide trống hoặc chỉ có tiêu đề

HTML format:
- A4 landscape (297mm x 210mm)
- Class "slide" cho mỗi slide
- @page size: A4 landscape, margin: 0
- page-break-after: always
- Chart.js CDN + responsive config

Output: HTML string hoàn chỉnh (<!DOCTYPE html>...</html>)"""
        
        messages = [
            {"role": "user", "content": user_message}
        ]
        
        response = await self.send_message(
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            system=system,
            thinking_enabled=False
        )
        
        # Extract text from content blocks
        text_content = ""
        for block in response["content"]:
            if block["type"] == "text" and block["text"]:
                text_content += block["text"]
        
        return text_content
    
    async def send_message_with_document(
        self,
        user_message: str,
        document_base64: str,
        media_type: str,
        model: str = "claude-sonnet-4-5-20250929",
        max_tokens: int = 30000,
        max_slides: int = 5
    ) -> str:
        """
        Send message with document (PDF/DOCX) to Claude
        
        Args:
            user_message: User's message text
            document_base64: Base64 encoded document
            media_type: MIME type of document
            model: Claude model to use
            max_tokens: Maximum tokens in response
            
        Returns:
            Text response from Claude
        """
        # Default system prompt for HTML slide generation - use same as send_simple_message
        system = f"""Phân tích file và tạo {max_slides} slides HTML báo cáo. Mỗi slide kết hợp số liệu, biểu đồ và text.

QUY TẮC:
- Đúng {max_slides} slides, không thêm không bớt
- Mỗi slide: tiêu đề + biểu đồ Chart.js + KPI numbers + bullet points insight
- Chọn chart type phù hợp data: Line (xu hướng), Bar (so sánh), Pie (tỷ lệ), Combo
- Layout tự do, không bắt buộc format cứng
- Màu sắc professional, không quá màu mè
- KHÔNG tạo slide trống hoặc chỉ có tiêu đề

HTML format:
- A4 landscape (297mm x 210mm)
- Class "slide" cho mỗi slide
- @page size: A4 landscape, margin: 0
- page-break-after: always
- Chart.js CDN + responsive config

Output: HTML string hoàn chỉnh (<!DOCTYPE html>...</html>)"""
        
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_message
                    },
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": document_base64
                        }
                    }
                ]
            }
        ]
        
        response = await self.send_message(
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            system=system,
            thinking_enabled=False
        )
        
        # Extract text from content blocks
        text_content = ""
        for block in response["content"]:
            if block["type"] == "text" and block["text"]:
                text_content += block["text"]
        
        return text_content


# Global instance
claude_service = ClaudeService()
