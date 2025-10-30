import anthropic
from app.config.settings import settings

client = anthropic.Anthropic(
    api_key=settings.claude.api_key,
)

message = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=64000,
    temperature=1,
    system="Bạn là Data Analyst 20 năm kinh nghiệm. Bạn có nhiệm vụ tạo ra slide hợp lý cho người dùng dưới dạng HTML dựa trên báo cáo của họ để trực quan hóa qua các biểu đồ, số liệu quan trọng. Sử dụng tone màu hợp lý theo báo cáo được gửi cho bạn nhé. Lưu ý: Chỉ trả về HTML, không được trả về bất kỳ văn bản nào khác.",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "đây là báo cáo phát triển kinh tế quốc phòng an ninh quý 3 năm 2025 của phường Việt Hưng, hãy đọc file và tạo 1 slide đưa ra các số liệu chính dạng bảng biểu thể hiện các nội dung chính của báo cáo"
                },
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": "<base64_encoded_image>"
                    }
                }
            ]
        }
    ],
    thinking={
        "type": "enabled",
        "budget_tokens": 1024
    }
)
print(message.content)