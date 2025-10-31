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
        max_tokens: int = 60000,
        system: Optional[str] = None
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
            system = """BẠN LÀ CHUYÊN GIA TẠO BÁO CÁO SLIDESHOW CHUYÊN NGHIỆP.

🎯 NHIỆM VỤ:
- Đọc kỹ file PDF/DOCX
- Tạo SLIDESHOW 3-4 SLIDES (tối đa 5 trang)
- Mỗi slide có biểu đồ Chart.js minh họa số liệu thực
- KHÔNG tạo slide bìa riêng, đi thẳng vào nội dung

📋 CẤU TRÚC:
• Slide 1: TỔNG QUAN (KPI + biểu đồ overview)
• Slide 2-3: PHÂN TÍCH CHI TIẾT (mỗi slide 1 chủ đề + biểu đồ)
• Slide 4: KẾT LUẬN (nếu cần)

⚠️ QUY TẮC:
✅ Số liệu THẬT từ tài liệu
✅ Màu professional: Navy (#1e40af, #3b82f6) + Xám (#6b7280)
✅ Biểu đồ Chart.js đầy đủ
❌ KHÔNG quá 5 trang
❌ KHÔNG markdown code block
❌ KHÔNG giải thích bên ngoài HTML

💻 FORMAT HTML SLIDESHOW:
- Mỗi slide: <div class="slide"> với position: absolute, width: 100vw, height: 100vh
- Slide đầu tiên có class="active", các slide khác display: none
- Navigation buttons (◀ ▶) fixed position
- JavaScript để chuyển slide
- Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js

✅ TRẢ VỀ: HTML hoàn chỉnh bắt đầu với <!DOCTYPE html>"""
        
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
        max_tokens: int = 60000
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
        # Default system prompt for HTML slide generation
        system = """BẠN LÀ CHUYÊN GIA TẠO BÁO CÁO SLIDESHOW CHUYÊN NGHIỆP.

🎯 NHIỆM VỤ:
- Đọc kỹ file PDF/DOCX
- Tạo SLIDESHOW 3-4 SLIDES (tối đa 5 trang)
- Mỗi slide có biểu đồ Chart.js minh họa số liệu thực
- KHÔNG tạo slide bìa riêng, đi thẳng vào nội dung

📋 CẤU TRÚC:
• Slide 1: TỔNG QUAN (KPI + biểu đồ overview)
• Slide 2-3: PHÂN TÍCH CHI TIẾT (mỗi slide 1 chủ đề + biểu đồ)
• Slide 4: KẾT LUẬN (nếu cần)

⚠️ QUY TẮC:
✅ Số liệu THẬT từ tài liệu
✅ Màu professional: Navy (#1e40af, #3b82f6) + Xám (#6b7280)
✅ Biểu đồ Chart.js đầy đủ
❌ KHÔNG quá 5 trang
❌ KHÔNG markdown code block
❌ KHÔNG giải thích bên ngoài HTML

💻 FORMAT HTML SLIDESHOW:
- Mỗi slide: <div class="slide"> với position: absolute, width: 100vw, height: 100vh
- Slide đầu tiên có class="active", các slide khác display: none
- Navigation buttons (◀ ▶) fixed position
- JavaScript để chuyển slide
- Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js

✅ TRẢ VỀ: HTML hoàn chỉnh bắt đầu với <!DOCTYPE html>"""
        
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
