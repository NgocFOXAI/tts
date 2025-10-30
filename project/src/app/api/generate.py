from fastapi import APIRouter, Form, File, UploadFile
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/generate", tags=["Text Generation"])

class GenerateResponse(BaseModel):
    response: str

@router.post("/text")
async def generate_text(
    prompt: str = Form(..., description="Text prompt for generation"),
    files: List[UploadFile] = File(default=[], description="Optional files to include in the prompt")
):
    """
    Generate text với CONFIG CỨNG - Frontend chỉ cần gửi prompt + files
    Config (model, temperature, max_tokens, system_prompt) được lấy từ /api/config
    """
    try:
        # Import services
        from ..core import ai_service
        from .config import current_config
        
        # Sử dụng config cứng từ current_config
        model = current_config["model"]
        temperature = current_config["model_parameters"].temperature
        top_p = current_config["model_parameters"].top_p
        max_tokens = current_config["model_parameters"].max_tokens
        system_prompt_text = current_config["system_prompt"]
        
        print(f"[AI CHAT] Using hardcoded config:")
        print(f"  Model: {model}")
        print(f"  Temperature: {temperature}")
        print(f"  Max Tokens: {max_tokens}")
        print(f"  System Prompt: {system_prompt_text[:100]}...")

        # Process uploaded files
        processed_files = []
        if files:
            import tempfile
            import os
            import mimetypes

            for file in files:
                if file.filename:
                    # Create temporary file
                    suffix = os.path.splitext(file.filename)[1]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                        content = await file.read()
                        temp_file.write(content)
                        temp_path = temp_file.name

                    # Get MIME type
                    mime_type, _ = mimetypes.guess_type(file.filename)
                    if not mime_type:
                        mime_type = file.content_type or 'application/octet-stream'

                    processed_files.append({
                        'filename': file.filename,
                        'file_path': temp_path,
                        'mime_type': mime_type,
                        'size': len(content)
                    })

        # Generate text
        result = await ai_service.generate_text_with_files(
            prompt=prompt,
            files=processed_files,
            model=model,
            system_prompt=system_prompt_text,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens
        )

        # Clean up temporary files
        for file_info in processed_files:
            try:
                os.unlink(file_info['file_path'])
            except:
                pass

        if result["success"]:
            generated_text = result["generated_text"]

            #  Caching disabled - return response directly
            print(f" Text generation completed (caching disabled)")
            print(f"   Content length: {len(generated_text)} chars")
            
            return GenerateResponse(response=generated_text)
        else:
            return GenerateResponse(response=f"Error: {result.get('error', 'Unknown error')}")

    except Exception as e:
        return GenerateResponse(response=f"Error: {str(e)}")

