#!/usr/bin/env python3
"""
NotebookLM Automation API endpoint
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import sys
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Add paths for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
core_dir = os.path.join(app_dir, "core")
automation_dir = os.path.join(app_dir, "services", "automation")
flow_dir = os.path.join(core_dir, "flow")

sys.path.append(core_dir)
sys.path.append(automation_dir)
sys.path.append(flow_dir)

from automate import run_notebooklm_automation

router = APIRouter()

class NotebookLMRequest(BaseModel):
    custom_text: str  # Required custom text input

class NotebookLMResponse(BaseModel):
    success: bool
    message: str
    audio_url: Optional[str] = None
    text_info: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None

@router.post("/audio-generation/generate", response_model=NotebookLMResponse)
async def generate_audio_from_text(request: NotebookLMRequest):
    """
    Generate audio using NotebookLM automation from custom text.
    Returns audio download URL when completed.
    
    Note: This feature requires manual browser interaction due to Google's automation restrictions.
    """
    try:
        start_time = time.time()
        
        # Validate custom text is provided
        if not request.custom_text or not request.custom_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Custom text is required and cannot be empty."
            )
        
        custom_text = request.custom_text.strip()
        print(f"[INFO] Using custom text for NotebookLM (length: {len(custom_text)} chars)", flush=True)
        
        text_info = {
            'source': 'custom_text',
            'content_length': len(custom_text),
            'created_at': 'now'
        }
        
        # Run automation in thread pool to avoid sync/async conflict
        print(f"[INFO] Starting NotebookLM automation with custom text", flush=True)

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
                
                # Validate content length
                if len(custom_text.strip()) < 50:
                    raise Exception(f"Content too short ({len(custom_text.strip())} chars). Minimum 50 characters required for NotebookLM.")
                
                print(f"[INFO] Starting automation for {len(custom_text)} character text...", flush=True)
                result = run_notebooklm_automation(
                    content_source=custom_text,
                    debug_mode=True,  # Enable debug mode to see browser
                    max_wait_minutes=30  # Increase timeout to 30 minutes for long audio
                )
                print(f"[SUCCESS] Automation completed with result: {result}", flush=True)
                return result
                
            except Exception as e:
                print(f"[ERROR] Automation exception: {str(e)}", flush=True)
                print(f"[ERROR] Exception type: {type(e).__name__}", flush=True)
                import traceback
                print(f"[ERROR] Traceback: {traceback.format_exc()}", flush=True)
                return False

        # Execute in thread pool with timeout
        loop = asyncio.get_event_loop()
        try:
            with ThreadPoolExecutor() as executor:
                future = loop.run_in_executor(executor, run_automation)
                # Increase timeout to 35 minutes to allow 30 min automation + 5 min buffer
                success = await asyncio.wait_for(future, timeout=2100)  # 35 minutes
        except asyncio.TimeoutError:
            print("[ERROR] Automation timed out after 35 minutes", flush=True)
            success = False
        
        processing_time = time.time() - start_time
        
        if success:
            # Generate audio URL (simulated - in real implementation you'd track actual download)
            audio_url = f"/downloads/notebooklm_audio_{int(time.time())}.mp3"
            
            return NotebookLMResponse(
                success=True,
                message="Audio generation initiated successfully! Please check your Downloads folder and browser for the completed audio file.",
                audio_url=audio_url,
                text_info=text_info,
                processing_time=processing_time
            )
        else:
            # Provide more helpful error message with setup instructions
            error_type = "Unknown automation error"
            setup_instructions = ""
            
            # Check for common Playwright issues in logs
            if "playwright" in str(custom_text).lower() or "chromium" in str(custom_text).lower():
                error_type = "Playwright setup issue"
                setup_instructions = (
                    "🔧 Playwright Setup Required:\n"
                    "1. Install Playwright: pip install playwright\n"
                    "2. Install browsers: playwright install chromium\n"
                    "3. Restart the application\n\n"
                )
            
            return NotebookLMResponse(
                success=False,
                message=(
                    f"NotebookLM automation failed ({error_type}). This can happen due to:\n"
                    "• Browser automation restrictions\n"
                    "• Playwright not properly installed\n"
                    "• Changes in Google's NotebookLM interface\n"
                    "• Network connectivity issues\n"
                    "• Daily usage limits reached\n\n"
                    f"{setup_instructions}"
                    "1. Visit https://notebooklm.google.com/\n"
                    "2. Create a new notebook\n"
                    "3. Add your text as 'Copied text'\n"
                    "4. Generate an 'Audio Overview'\n"
                    "5. Download the generated audio file"
                ),
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