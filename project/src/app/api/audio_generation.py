#!/usr/bin/env python3
"""
NotebookLM Automation API endpoint
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import sys
import time
import hashlib
from ..config.loggings import get_logger
from ..utils.logger_utils import log_cache_operation, log_file_operation, log_automation_start, log_automation_complete, log_automation_error

logger = get_logger(__name__)

# File cache directory - persistent across server restarts
CACHE_DIR = "static/file_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory cache: hash -> file_path
FILE_CACHE = {}

# Supported file types based on NotebookLM capabilities
SUPPORTED_FILE_TYPES = {
    # Text files
    "text/plain": ['.txt'],
    "text/markdown": ['.md'],
    # Document files
    "application/pdf": ['.pdf'],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ['.docx'],
    "application/msword": ['.doc'],
    # Audio files
    "audio/mpeg": ['.mp3'],
    "audio/mp4": ['.m4a'],
    "audio/wav": ['.wav'],
    "audio/aac": ['.aac'],
    "audio/ogg": ['.ogg'],
    # Video files
    "video/mp4": ['.mp4'],
    "video/mpeg": ['.mpeg'],
    "video/quicktime": ['.mov'],
    # Other formats
    "application/rtf": ['.rtf']
}

def get_cached_file_path(file_hash: str, filename: str) -> Optional[str]:
    """Check if file with this hash exists in cache, return path if found."""
    if file_hash in FILE_CACHE:
        cached_path = FILE_CACHE[file_hash]
        if os.path.exists(cached_path):
            return cached_path
    
    cached_path = os.path.join(CACHE_DIR, f"{file_hash}_{filename}")
    if os.path.exists(cached_path):
        FILE_CACHE[file_hash] = cached_path
        return cached_path
    
    return None

def save_to_cache(file_hash: str, filename: str, content: bytes) -> str:
    """Save file to cache directory and return path."""
    cached_path = os.path.join(CACHE_DIR, f"{file_hash}_{filename}")
    with open(cached_path, 'wb') as f:
        f.write(content)
    FILE_CACHE[file_hash] = cached_path
    return cached_path

def validate_file_type(filename: str, content_type: str) -> bool:
    """Validate if file type is supported by NotebookLM."""
    file_extension = os.path.splitext(filename)[1].lower()
    
    if content_type in SUPPORTED_FILE_TYPES:
        if file_extension in SUPPORTED_FILE_TYPES[content_type]:
            return True
    
    # Check by extension fallback
    for extensions in SUPPORTED_FILE_TYPES.values():
        if file_extension in extensions:
            return True
    
    return False

def get_supported_extensions() -> str:
    """Get comma-separated string of supported file extensions."""
    extensions = []
    for exts in SUPPORTED_FILE_TYPES.values():
        extensions.extend(exts)
    return ', '.join(sorted(set(extensions)))

# Add paths for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
core_dir = os.path.join(app_dir, "core")
flow_dir = os.path.join(core_dir, "flow")

sys.path.append(core_dir)
sys.path.append(flow_dir)

from automate import run_notebooklm_automation

router = APIRouter(
    prefix="/audio-generation",
    tags=["NotebookLM Audio Generation"],
    responses={404: {"description": "Not found"}},
)

class NotebookLMResponse(BaseModel):
    success: bool
    message: str
    text_info: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None

async def process_uploaded_files(files: List[UploadFile]) -> List[tuple]:
    """Process uploaded files with caching and validation."""
    files_content = []
    
    for file in files:
        if not file:
            continue
            
        file_content_bytes = await file.read()
        filename = file.filename
        file_hash = hashlib.md5(file_content_bytes).hexdigest()
        
        # Check cache
        cached_path = get_cached_file_path(file_hash, filename)
        if cached_path:
            log_cache_operation(logger, "HIT", filename, f"hash: {file_hash[:8]}")
            files_content.append((file_content_bytes, filename))
            continue
        
        log_cache_operation(logger, "MISS", filename, f"hash: {file_hash[:8]}")
        
        # Validate file type
        if not validate_file_type(filename, file.content_type):
            logger.warning(f"Unsupported file type: {file.content_type} for file {filename}")
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type} ({os.path.splitext(filename)[1]}) "
                       f"in file {filename}. Supported types: {get_supported_extensions()}"
            )
        
        # Add to list and cache
        files_content.append((file_content_bytes, filename))
        save_to_cache(file_hash, filename, file_content_bytes)
        log_file_operation(logger, "CACHED", filename, f"{file.content_type} | {len(file_content_bytes)} bytes")
    
    if not files_content:
        raise HTTPException(status_code=400, detail="No valid files provided.")
    
    return files_content


@router.post("/generate", response_model=NotebookLMResponse)
async def generate_audio_from_text(
    custom_text: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None)
):
    """
    Generate audio using NotebookLM automation from custom text or uploaded files.
    Audio files will be saved to the static/audio_downloads folder.
    
    This endpoint runs synchronously and returns the actual result after processing completes.
    """
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    start_time = time.time()
    
    try:
        # Validate input
        if not custom_text and not files:
            raise HTTPException(
                status_code=400,
                detail="Either custom_text or files must be provided."
            )
        
        # Process files if provided
        files_content = []
        if files:
            files_content = await process_uploaded_files(files)
            content_source = f"files:{len(files_content)}"
            content = f"File uploads: {', '.join([f[1] for f in files_content])}"
            logger.info(f"Processing {len(files_content)} files for audio generation")
        else:
            # Process text input
            content = custom_text.strip()
            content_source = "custom_text"
            
            if not content:
                logger.warning("Audio generation attempted with empty content")
                raise HTTPException(
                    status_code=400,
                    detail="Content is required and cannot be empty."
                )
            
            if len(content) < 50:
                logger.warning(f"Audio generation attempted with too short content: {len(content)} chars")
                raise HTTPException(
                    status_code=400,
                    detail=f"Content too short ({len(content)} chars). Minimum 50 characters required."
                )
        
        # Prepare text info for response
        text_info = {
            'source': content_source,
            'content_length': len(content) if not files_content else sum(len(f[0]) for f in files_content),
            'filenames': [f[1] for f in files_content] if files_content else None,
            'file_count': len(files_content) if files_content else 0,
        }
        
        # Log automation start
        if files_content:
            content_desc = f"{len(files_content)} files: {', '.join([f[1] for f in files_content])}"
            if len(files_content) > 1:
                logger.info("⚠️ Multiple files - audio generation may take 15-40 minutes")
        else:
            content_desc = f"{len(content)} character text content"
        
        log_automation_start(logger, "NotebookLM", {
            "content_type": content_source,
            "file_count": len(files_content) if files_content else 0,
            "content_length": text_info['content_length']
        })
        
        # Run automation in thread pool to avoid asyncio conflict with Playwright sync API
        def run_automation_sync():
            """Run automation in separate thread to avoid asyncio loop conflict."""
            return run_notebooklm_automation(
                content_source=content or "Multiple files upload",
                debug_mode=True,
                max_wait_minutes=45,
                files_content=files_content if files_content else None,
                file_content=files_content[0][0] if len(files_content) == 1 else None,
                filename=files_content[0][1] if len(files_content) == 1 else None
            )
        
        # Run in thread pool executor
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            result = await loop.run_in_executor(executor, run_automation_sync)
        
        processing_time = time.time() - start_time
        
        if result:
            log_automation_complete(logger, "NotebookLM", processing_time, "Audio saved to downloads")
            return NotebookLMResponse(
                success=True,
                message=f"Tạo podcast thành công!\n\n"
                        f"Thời gian xử lý: {processing_time:.1f} giây\n"
                        f"Nguồn: {content_source}\n"
                        f"Số file: {len(files_content) if files_content else 0}\n\n"
                        f"Âm thanh đã được lưu trong phần Quản Lý Âm Thanh.",
                text_info=text_info,
                processing_time=processing_time
            )
        else:
            logger.error(f"NotebookLM automation failed after {processing_time:.2f}s")
            raise HTTPException(
                status_code=500,
                detail="Automation failed. Please check server logs for details."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = time.time() - start_time
        log_automation_error(logger, "NotebookLM", e, processing_time)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate audio: {str(e)}"
        )