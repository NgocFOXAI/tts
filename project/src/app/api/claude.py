from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, Response
from typing import Optional
from app.core.claude.claude_service import claude_service
from app.core.pdf_generator import pdf_generator
import logging
import base64

router = APIRouter(tags=["Claude AI"])
logger = logging.getLogger(__name__)


@router.post("/claude/chat", summary="Chat with Claude AI")
async def chat_with_claude(
    message: str = Form(..., description="User message to send to Claude"),
    file: Optional[UploadFile] = File(None, description="Optional PDF or DOCX file"),
    output_format: str = Form("html", description="Output format: 'html' or 'pdf'"),
    max_slides: int = Form(5, description="Maximum number of slides to generate (3-5, default: 5)")
):
    """
    Send message to Claude AI and get HTML or PDF response
    
    Supports optional file upload (PDF/DOCX) for document analysis.
    Returns HTML or PDF based on output_format parameter.
    Allows specifying max_slides to control the number of slides generated (3-5).
    """
    try:
        # Validate max_slides
        max_slides = max(3, min(5, max_slides))  # Clamp between 3-5
        # If file is provided, send with document
        if file:
            # Validate file type
            allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=400, 
                    detail="Only PDF and DOCX files are allowed"
                )
            
            # Read and encode file
            file_content = await file.read()
            base64_content = base64.b64encode(file_content).decode('utf-8')
            
            # Call service with document
            html_content = await claude_service.send_message_with_document(
                user_message=message,
                document_base64=base64_content,
                media_type=file.content_type,
                max_slides=max_slides
            )
        else:
            # Call service without document
            html_content = await claude_service.send_simple_message(
                user_message=message,
                max_slides=max_slides
            )
        
        # Log slide count for monitoring
        slide_count = html_content.count('<div class="slide"')
        logger.info(f"📊 Generated {slide_count} slides with A4 landscape format")
        
        # Save to dashboard
        file_info = await pdf_generator.save_dashboard_file(html_content)
        
        # Return based on format
        if output_format.lower() == "pdf":
            # Read and return PDF
            with open(file_info["pdf_path"], 'rb') as f:
                pdf_bytes = f.read()
            
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={file_info['filename']}.pdf",
                    "X-File-Info": str(file_info)
                }
            )
        else:
            # Return HTML with file info in header
            return HTMLResponse(
                content=html_content, 
                status_code=200,
                headers={
                    "X-File-Info": str(file_info)
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calling Claude API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calling Claude API: {str(e)}")


@router.get("/claude/dashboard", summary="List all dashboard files")
async def list_dashboard_files():
    """
    Get list of all saved dashboard files (HTML and PDF)
    
    Returns list of files with metadata (filename, URLs, creation time, size)
    """
    try:
        files = pdf_generator.list_dashboard_files()
        return {
            "total": len(files),
            "files": files
        }
    except Exception as e:
        logger.error(f"Error listing dashboard files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.delete("/claude/dashboard/{filename}", summary="Delete dashboard file")
async def delete_dashboard_file(filename: str):
    """
    Delete a dashboard file (both HTML and PDF)
    
    Args:
        filename: The filename (without extension) to delete
    """
    try:
        deleted = pdf_generator.delete_dashboard_file(filename)
        
        if deleted:
            return {
                "success": True,
                "message": f"File '{filename}' deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dashboard file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
