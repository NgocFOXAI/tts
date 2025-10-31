#!/usr/bin/env python3
"""
NotebookLM Automation API endpoint
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union, List
import os
import sys
import time
import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor

# File cache directory - persistent across server restarts
CACHE_DIR = "static/file_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory cache: hash -> file_path
FILE_CACHE = {}

def get_cached_file_path(file_hash: str, filename: str) -> Optional[str]:
    """Check if file with this hash exists in cache, return path if found."""
    # Check memory cache first
    if file_hash in FILE_CACHE:
        cached_path = FILE_CACHE[file_hash]
        if os.path.exists(cached_path):
            return cached_path
    
    # Check disk cache
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

# Add paths for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
core_dir = os.path.join(app_dir, "core")
automation_dir = os.path.join(app_dir, "services", "automation")
flow_dir = os.path.join(core_dir, "flow")

sys.path.append(core_dir)
sys.path.append(automation_dir)
sys.path.append(flow_dir)

# Import directly using sys.path
import automate
from automate import run_notebooklm_automation

router = APIRouter(
    prefix="/audio-generation",
    tags=["NotebookLM Audio Generation"],
    responses={404: {"description": "Not found"}},
)

class NotebookLMRequest(BaseModel):
    custom_text: Optional[str] = None  # Optional custom text input

class NotebookLMResponse(BaseModel):
    success: bool
    message: str
    text_info: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None

@router.post("/generate", response_model=NotebookLMResponse)
async def generate_audio_from_text(
    custom_text: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None)
):
    """
    Generate audio using NotebookLM automation from custom text or uploaded files.
    Audio files will be saved to the static/audio_downloads folder.
    
    The API will queue the generation task and return immediately.
    Audio will be available in the Audio Management section after processing completes.
    """
    try:
        start_time = time.time()
        
        # Validate that either text or files is provided
        if not custom_text and not files:
            raise HTTPException(
                status_code=400,
                detail="Either custom_text or files must be provided."
            )
        
        # Process input content
        content = None
        content_source = None
        files_content = []  # List of (file_content_bytes, filename) tuples
        
        if files:
            # Handle multiple file uploads
            try:
                for file in files:
                    if not file:
                        continue
                    # Read file content
                    file_content_bytes = await file.read()
                    filename = file.filename
                    
                    # Generate file hash for caching
                    file_hash = hashlib.md5(file_content_bytes).hexdigest()
                    
                    # Check if file already in cache
                    cached_path = get_cached_file_path(file_hash, filename)
                    if cached_path:
                        print(f"[CACHE HIT]  Using cached file: {filename} (hash: {file_hash[:8]}...)")
                        files_content.append((file_content_bytes, filename))
                        continue
                    
                    print(f"[CACHE MISS]  Processing new file: {filename} (hash: {file_hash[:8]}...)")
                    
                    # Define supported file types based on NotebookLM capabilities
                    supported_types = {
                        # Text files
                        "text/plain": ['.txt'],
                        "text/markdown": ['.md'],
                        
                        # Document files
                        "application/pdf": ['.pdf'],
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ['.docx'],
                        "application/msword": ['.doc'],
                        
                        # Audio files (NotebookLM can process these)
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
                    
                    # Check if file type is supported
                    file_extension = os.path.splitext(filename)[1].lower()
                    content_type = file.content_type
                    
                    is_supported = False
                    if content_type in supported_types:
                        if file_extension in supported_types[content_type]:
                            is_supported = True
                    else:
                        # Check by extension fallback
                        for mime_type, extensions in supported_types.items():
                            if file_extension in extensions:
                                is_supported = True
                                break
                    
                    if not is_supported:
                        supported_extensions = []
                        for extensions in supported_types.values():
                            supported_extensions.extend(extensions)
                        
                        raise HTTPException(
                            status_code=400,
                            detail=f"Unsupported file type: {content_type} ({file_extension}) in file {filename}. "
                                   f"Supported types: {', '.join(sorted(set(supported_extensions)))}"
                        )
                    
                    # Add to files list and save to cache
                    file_tuple = (file_content_bytes, filename)
                    files_content.append(file_tuple)
                    
                    # Save to persistent cache
                    save_to_cache(file_hash, filename, file_content_bytes)
                    print(f"[CACHED]  File processed and cached: {filename} ({content_type})")
                
                if not files_content:
                    raise HTTPException(
                        status_code=400,
                        detail="No valid files provided."
                    )
                
                filenames = [f[1] for f in files_content]
                content = f"File uploads: {', '.join(filenames)}"
                content_source = f"files:{len(files_content)}"
                print(f"[INFO] Multiple files upload ready: {len(files_content)} files")
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Error processing files: {str(e)}"
                )
        else:
            # Handle text input
            content = custom_text.strip()
            content_source = "custom_text"
        
        # Validate content (for text input only)
        if not files_content and (not content or not content.strip()):
            raise HTTPException(
                status_code=400,
                detail="Content is required and cannot be empty."
            )
        
        if content:
            content = content.strip()
        
        print(f"[INFO] Queuing NotebookLM automation with {content_source}", flush=True)
        
        text_info = {
            'source': content_source,
            'content_length': len(content) if content else sum(len(f[0]) for f in files_content) if files_content else 0,
            'filenames': [f[1] for f in files_content] if files_content else None,
            'file_count': len(files_content) if files_content else 0,
            'created_at': 'now'
        }
        
        # Start automation in background thread (fire and forget)
        def run_automation():
            try:
                # Check Playwright availability first
                try:
                    from playwright.sync_api import sync_playwright
                    import os
                    import asyncio
                    
                    # Windows-specific fix for subprocess
                    if os.name == 'nt':  # Windows
                        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                    
                    # Test Playwright installation properly
                    print(f"[INFO] Testing Playwright installation...", flush=True)
                    with sync_playwright() as p:
                        browser_path = p.chromium.executable_path
                        if not browser_path or not os.path.exists(browser_path):
                            raise Exception("Playwright Chromium browser not found. Please run: playwright install chromium")
                        print(f"[SUCCESS] Playwright Chromium found at: {browser_path}", flush=True)
                except ImportError:
                    raise Exception("Playwright not installed. Please run: pip install playwright && playwright install chromium")
                except Exception as e:
                    error_msg = str(e).lower()
                    if "not found" in error_msg or "chromium" in error_msg:
                        raise e
                    elif "target page" in error_msg or "browser has been closed" in error_msg:
                        print(f"[WARNING] Browser closed during automation: {e}", flush=True)
                        raise Exception(f"Browser automation interrupted: {e}")
                    else:
                        print(f"[ERROR] Playwright error: {e}", flush=True)
                        raise Exception(f"Playwright setup issue: {e}")
                
                # Validate content length (only for text input)
                if not files_content and len(content.strip()) < 50:
                    raise Exception(f"Content too short ({len(content.strip())} chars). Minimum 50 characters required for NotebookLM.")
                
                if files_content:
                    content_desc = f"{len(files_content)} files: {', '.join([f[1] for f in files_content])}"
                    if len(files_content) > 1:
                        print(f"[INFO] Multiple files detected - audio generation may take 15-40 minutes", flush=True)
                        print(f"[INFO] Files will be uploaded to the same notebook session for comprehensive audio overview", flush=True)
                else:
                    content_desc = f"{len(content)} character content"
                    
                print(f"[INFO] Starting automation for {content_desc}...")
                result = run_notebooklm_automation(
                    content_source=content or "Multiple files upload",
                    debug_mode=True,  # Enable debug mode to see browser
                    max_wait_minutes=45,  # Increase timeout to 45 minutes for multiple files
                    files_content=files_content if files_content else None,
                    file_content=files_content[0][0] if files_content and len(files_content) == 1 else None,
                    filename=files_content[0][1] if files_content and len(files_content) == 1 else None
                )
                print(f"[SUCCESS] Automation completed with result: {result}", flush=True)
                return result
                
            except Exception as e:
                print(f"[ERROR] Automation exception: {str(e)}", flush=True)
                print(f"[ERROR] Exception type: {type(e).__name__}", flush=True)
                import traceback
                print(f"[ERROR] Traceback: {traceback.format_exc()}", flush=True)
                return False

        # Start background task (fire and forget)
        executor = ThreadPoolExecutor(max_workers=1)
        executor.submit(run_automation)
        
        processing_time = time.time() - start_time
        
        # Return immediately with queued status
        estimated_minutes = 15 if files_content and len(files_content) > 1 else 8
        
        return NotebookLMResponse(
            success=True,
            message=f" Yêu cầu tạo podcast đã được gửi đến hệ thống!\n\n"
                    f"⏱️ Thời gian xử lý dự kiến: {estimated_minutes}-30 phút\n"
                    f"Nguồn: {content_source}\n"
                    f"📊 Số file: {len(files_content) if files_content else 0}\n\n"
                    f"🎧 Âm thanh sau khi hoàn thành sẽ được lưu trong phần Quản Lý Âm Thanh.",
            text_info=text_info,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_message = (
            f"Failed to generate audio: {str(e)}\n\n"
        )
        raise HTTPException(
            status_code=500,
            detail=error_message
        )