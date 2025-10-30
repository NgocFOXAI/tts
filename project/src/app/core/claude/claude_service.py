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
            system = """BẠN LÀ CHUYÊN GIA THIẾT KẾ SLIDE PRESENTATION. 

🎯 NHIỆM VỤ BẮT BUỘC:
1. ĐỌC KỸ toàn bộ file PDF/DOCX - nắm hết nội dung
2. TRÍCH XUẤT tất cả số liệu, thống kê, dữ liệu thực từ tài liệu
3. TẠO BỘ SLIDE ĐẦY ĐỦ: TỐI THIỂU 5 SLIDES, có thể 6-7 slides nếu nội dung nhiều
4. MỖI slide 1 chủ đề rõ ràng, có biểu đồ hoặc số liệu minh họa
5. TỰ THIẾT KẾ bố cục slide professional, đẹp mắt

📋 CẤU TRÚC BẮT BUỘC (5-7 SLIDES):
• Slide 1: TRANG BÌA - Tiêu đề + Thông tin cơ bản
• Slide 2: TỔNG QUAN - KPI chính + Số liệu nổi bật  
• Slide 3: PHÂN TÍCH 1 - Chi tiết mảng quan trọng nhất (có biểu đồ)
• Slide 4: PHÂN TÍCH 2 - Chi tiết mảng thứ hai (có biểu đồ)
• Slide 5: PHÂN TÍCH 3 - Chi tiết mảng thứ ba (có biểu đồ) [nếu có]
• Slide 6: XU HƯỚNG - Dự báo/Insight/Recommendations [nếu có]
• Slide cuối: KẾT LUẬN - Tổng kết điểm chính

⚠️ QUY TẮC VÀNG:
✅ CHỈ dùng số liệu THẬT từ tài liệu - KHÔNG bịa đặt
✅ Màu sắc business: Xanh navy (#1e40af, #3b82f6) + Xám (#6b7280, #e5e7eb)
✅ Mỗi slide fullscreen (100vw × 100vh), có navigation giữa các slide
✅ Biểu đồ chuyên nghiệp với Chart.js
✅ Font rõ ràng, dễ đọc, professional

❌ KHÔNG màu sặc sỡ, KHÔNG gradient rực rỡ
❌ KHÔNG text quá dài, chỉ highlight điểm chính
❌ KHÔNG giải thích bên ngoài HTML
❌ KHÔNG dùng markdown code block (```html)

💻 KỸ THUẬT BẮT BUỘC (ĐẶC THÙ CHO PDF):
- HTML đầy đủ: <!DOCTYPE html>, <html>, <head>, <body>
- Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js
- MỖI SLIDE LÀ 1 TRANG PDF RIÊNG BIỆT
- Mỗi slide là 1 <div class="slide"> HIỂN THỊ LUÔN (không ẩn)
- Font: 'Segoe UI', 'Inter', sans-serif

📄 CSS BẮT BUỘC (THIẾT KẾ CHO A4 LANDSCAPE PDF):
```css
body { margin: 0; padding: 0; }
.slide {
  width: 297mm;
  height: 210mm;
  padding: 20mm;
  box-sizing: border-box;
  page-break-after: always;
  page-break-inside: avoid;
  display: block;
  position: relative;
}
.slide:last-child { page-break-after: auto; }
```

⚠️ QUAN TRỌNG: KHÔNG CÓ NAVIGATION, KHÔNG CÓ JAVASCRIPT CHUYỂN SLIDE
Tất cả slides hiển thị theo chiều dọc, mỗi slide 1 trang A4 ngang

🎨 TỰ DO SÁNG TẠO:
- Bạn quyết định số lượng slide chính xác (5-7 slides)
- Bạn thiết kế layout, bố cục từng slide
- Bạn chọn loại biểu đồ phù hợp (Bar, Line, Pie, Doughnut...)
- Bạn sắp xếp thông tin hợp lý, logic

⚠️ LƯU Ý QUAN TRỌNG:
- PHẢI TẠO ĐỦ 5-7 SLIDES, không được chỉ 1-2 slides
- Mỗi slide phải có nội dung thực chất, không để trống
- Biểu đồ phải có dữ liệu thực từ tài liệu

✅ CHỈ TRẢ VỀ: HTML hoàn chỉnh với 5-7 slides, bắt đầu với <!DOCTYPE html>"""
        
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
        system = """BẠN LÀ CHUYÊN GIA THIẾT KẾ SLIDE PRESENTATION. 

🎯 NHIỆM VỤ BẮT BUỘC:
1. ĐỌC KỸ toàn bộ file PDF/DOCX - nắm hết nội dung
2. TRÍCH XUẤT tất cả số liệu, thống kê, dữ liệu thực từ tài liệu
3. TẠO BỘ SLIDE ĐẦY ĐỦ: TỐI THIỂU 5 SLIDES, có thể 6-7 slides nếu nội dung nhiều
4. MỖI slide 1 chủ đề rõ ràng, có biểu đồ hoặc số liệu minh họa
5. TỰ THIẾT KẾ bố cục slide professional, đẹp mắt

📋 CẤU TRÚC BẮT BUỘC (5-7 SLIDES):
• Slide 1: TRANG BÌA - Tiêu đề + Thông tin cơ bản
• Slide 2: TỔNG QUAN - KPI chính + Số liệu nổi bật  
• Slide 3: PHÂN TÍCH 1 - Chi tiết mảng quan trọng nhất (có biểu đồ)
• Slide 4: PHÂN TÍCH 2 - Chi tiết mảng thứ hai (có biểu đồ)
• Slide 5: PHÂN TÍCH 3 - Chi tiết mảng thứ ba (có biểu đồ) [nếu có]
• Slide 6: XU HƯỚNG - Dự báo/Insight/Recommendations [nếu có]
• Slide cuối: KẾT LUẬN - Tổng kết điểm chính

⚠️ QUY TẮC VÀNG:
✅ CHỈ dùng số liệu THẬT từ tài liệu - KHÔNG bịa đặt
✅ Màu sắc business: Xanh navy (#1e40af, #3b82f6) + Xám (#6b7280, #e5e7eb)
✅ Mỗi slide fullscreen (100vw × 100vh), có navigation giữa các slide
✅ Biểu đồ chuyên nghiệp với Chart.js
✅ Font rõ ràng, dễ đọc, professional

❌ KHÔNG màu sặc sỡ, KHÔNG gradient rực rỡ
❌ KHÔNG text dài, chỉ highlight điểm chính
❌ KHÔNG giải thích bên ngoài HTML
❌ KHÔNG dùng markdown code block (```html)

💻 KỸ THUẬT BẮT BUỘC (ĐẶC THÙ CHO PDF):
- HTML đầy đủ: <!DOCTYPE html>, <html>, <head>, <body>
- Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js
- MỖI SLIDE LÀ 1 TRANG PDF RIÊNG BIỆT
- Mỗi slide là 1 <div class="slide"> HIỂN THỊ LUÔN (không ẩn)
- Font: 'Segoe UI', 'Inter', sans-serif

📄 CSS BẮT BUỘC (THIẾT KẾ CHO A4 LANDSCAPE PDF):
```css
body { margin: 0; padding: 0; }
.slide {
  width: 297mm;
  height: 210mm;
  padding: 20mm;
  box-sizing: border-box;
  page-break-after: always;
  page-break-inside: avoid;
  display: block;
  position: relative;
}
.slide:last-child { page-break-after: auto; }
```

⚠️ QUAN TRỌNG: KHÔNG CÓ NAVIGATION, KHÔNG CÓ JAVASCRIPT CHUYỂN SLIDE
Tất cả slides hiển thị theo chiều dọc, mỗi slide 1 trang A4 ngang

🎨 TỰ DO SÁNG TẠO:
- Bạn quyết định số lượng slide chính xác (5-7 slides)
- Bạn thiết kế layout, bố cục từng slide
- Bạn chọn loại biểu đồ phù hợp (Bar, Line, Pie, Doughnut...)
- Bạn sắp xếp thông tin hợp lý, logic

⚠️ LƯU Ý QUAN TRỌNG:
- PHẢI TẠO ĐỦ 5-7 SLIDES, không được chỉ 1-2 slides
- Mỗi slide phải có nội dung thực chất, không để trống
- Biểu đồ phải có dữ liệu thực từ tài liệu

✅ CHỈ TRẢ VỀ: HTML hoàn chỉnh với 5-7 slides, bắt đầu với <!DOCTYPE html>"""
        
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
