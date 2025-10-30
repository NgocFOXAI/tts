#!/usr/bin/env python3
"""
Document Management API endpoint
Allows users to manage uploaded documents and files
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union, List
import os
import sys
import time
import shutil
from datetime import datetime
import mimetypes

router = APIRouter(
    prefix="/documents",
    tags=["Document Management"],
    responses={404: {"description": "Not found"}},
)

# Add paths for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
project_dir = os.path.dirname(app_dir)

class DocumentInfo(BaseModel):
    filename: str
    file_size: int
    file_type: str
    upload_time: str
    file_path: str
    download_url: Optional[str] = None

class DocumentListResponse(BaseModel):
    success: bool
    message: str
    documents: List[DocumentInfo]
    total_count: int
    total_size: int

class DocumentDeleteResponse(BaseModel):
    success: bool
    message: str
    deleted_files: List[str]

class DocumentUploadResponse(BaseModel):
    success: bool
    message: str
    uploaded_files: List[DocumentInfo]

class ConversationGenerateRequest(BaseModel):
    filenames: List[str]

class ConversationGenerateResponse(BaseModel):
    success: bool
    message: str
    conversation_id: Optional[str] = None
    processing_time: Optional[float] = None

def get_upload_folder():
    """Get the upload folder path."""
    static_folder = os.path.join(project_dir, "static")
    upload_folder = os.path.join(static_folder, "upload_files")
    os.makedirs(upload_folder, exist_ok=True)
    return upload_folder

def get_file_info(file_path: str) -> DocumentInfo:
    """Get information about a file."""
    stat = os.stat(file_path)
    filename = os.path.basename(file_path)
    file_size = stat.st_size
    mime_type = mimetypes.guess_type(file_path)[0] or "unknown"
    
    # Convert MIME type to user-friendly format
    type_map = {
        'application/pdf': 'PDF',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
        'application/msword': 'Word',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
        'application/vnd.ms-excel': 'Excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
        'application/vnd.ms-powerpoint': 'PowerPoint',
        'text/plain': 'Text',
        'text/markdown': 'Markdown',
        'text/csv': 'CSV',
        'image/jpeg': 'Image',
        'image/png': 'Image',
        'image/gif': 'Image',
        'image/bmp': 'Image',
        'image/webp': 'Image',
        'audio/mpeg': 'Audio',
        'audio/wav': 'Audio',
        'audio/mp4': 'Audio',
        'audio/aac': 'Audio',
        'video/mp4': 'Video',
        'video/avi': 'Video',
        'application/zip': 'Archive',
        'application/x-rar-compressed': 'Archive'
    }
    
    file_type = type_map.get(mime_type, 'File')
    upload_time = datetime.fromtimestamp(stat.st_mtime).isoformat()
    
    return DocumentInfo(
        filename=filename,
        file_size=file_size,
        file_type=file_type,
        upload_time=upload_time,
        file_path=file_path,
        download_url=f"/api/documents/download/{filename}"
    )

@router.get("/list", response_model=DocumentListResponse)
async def list_uploaded_documents():
    """
    List all uploaded documents in the upload folder.
    Returns file information including size, type, and upload time.
    """
    try:
        upload_folder = get_upload_folder()
        documents = []
        total_size = 0
        
        if os.path.exists(upload_folder):
            for filename in os.listdir(upload_folder):
                file_path = os.path.join(upload_folder, filename)
                if os.path.isfile(file_path):
                    try:
                        doc_info = get_file_info(file_path)
                        documents.append(doc_info)
                        total_size += doc_info.file_size
                    except Exception as e:
                        print(f"Error reading file {filename}: {e}")
                        continue
        
        # Sort by upload time (newest first)
        documents.sort(key=lambda x: x.upload_time, reverse=True)
        
        return DocumentListResponse(
            success=True,
            message=f"Found {len(documents)} uploaded documents",
            documents=documents,
            total_count=len(documents),
            total_size=total_size
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list debug screenshots: {str(e)}"
        )

@router.post("/generate-conversation", response_model=ConversationGenerateResponse)
async def generate_conversation_from_documents(request: ConversationGenerateRequest):
    """
    Generate audio conversation from uploaded documents using NotebookLM.
    
    Args:
        request: Contains filenames and conversation settings
    """
    try:
        start_time = time.time()
        upload_folder = get_upload_folder()
        
        # Validate that files exist
        file_paths = []
        missing_files = []
        
        for filename in request.filenames:
            file_path = os.path.join(upload_folder, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                file_paths.append(file_path)
            else:
                missing_files.append(filename)
        
        if missing_files:
            raise HTTPException(
                status_code=400,
                detail=f"Files not found: {', '.join(missing_files)}"
            )
        
        if not file_paths:
            raise HTTPException(
                status_code=400,
                detail="No valid files provided for conversation generation"
            )
        
        # Import automation module
        import sys
        import os as os_import
        current_dir = os_import.path.dirname(os_import.path.abspath(__file__))
        app_dir = os_import.path.dirname(current_dir)
        core_dir = os_import.path.join(app_dir, "core")
        flow_dir = os_import.path.join(core_dir, "flow")
        
        if flow_dir not in sys.path:
            sys.path.append(flow_dir)
        
        try:
            from automate import run_notebooklm_automation
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail=f"NotebookLM automation module not available: {str(e)}"
            )
        
        # Prepare files content for automation
        files_content = []
        for file_path in file_paths:
            with open(file_path, 'rb') as f:
                file_content = f.read()
                filename = os.path.basename(file_path)
                files_content.append((file_content, filename))
        
        # Generate conversation ID
        import uuid
        conversation_id = f"conv_{int(time.time())}_{str(uuid.uuid4())[:8]}"
        
        # Prepare content source - simple default
        content_source = f"Create an engaging conversation discussing the key points from these {len(files_content)} documents"
        
        print(f"[INFO] Starting conversation generation for {len(files_content)} files...")
        print(f"[INFO] Conversation ID: {conversation_id}")
        print(f"[INFO] Files: {[f[1] for f in files_content]}")
        
        # Run automation with files
        def run_automation():
            try:
                result = run_notebooklm_automation(
                    content_source=content_source,
                    debug_mode=True,
                    max_wait_minutes=45,
                    files_content=files_content
                )
                return result
            except Exception as e:
                print(f"[ERROR] Automation error: {e}")
                return False
        
        # Execute automation
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_event_loop()
        try:
            with ThreadPoolExecutor() as executor:
                future = loop.run_in_executor(executor, run_automation)
                success = await asyncio.wait_for(future, timeout=2700)  # 45 minutes
        except asyncio.TimeoutError:
            print("[ERROR] Conversation generation timed out after 45 minutes", flush=True)
            success = False
        
        processing_time = time.time() - start_time
        
        if success:
            return ConversationGenerateResponse(
                success=True,
                message=f"Conversation generated successfully from {len(files_content)} documents! Check the downloads folder for the audio file.",
                conversation_id=conversation_id,
                processing_time=processing_time
            )
        else:
            return ConversationGenerateResponse(
                success=False,
                message=f"Failed to generate conversation from documents.",
                conversation_id=conversation_id,
                processing_time=processing_time
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate conversation: {str(e)}"
        )

@router.get("/download/{filename}")
async def download_document(filename: str):
    """
    Download a document file directly.
    
    Args:
        filename: Name of the file to download
    """
    try:
        upload_folder = get_upload_folder()
        file_path = os.path.join(upload_folder, filename)
        
        # Security check
        if not file_path.startswith(upload_folder):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return file for download
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download document: {str(e)}"
        )

@router.get("/view/{filename}")
async def view_document(filename: str):
    """
    View document content (for supported text formats).
    
    Args:
        filename: Name of the file to view
    """
    try:
        upload_folder = get_upload_folder()
        file_path = os.path.join(upload_folder, filename)
        
        # Security check
        if not file_path.startswith(upload_folder):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get file info
        doc_info = get_file_info(file_path)
        
        # Try to read text content for supported formats
        content = None
        if doc_info.file_type in ["text/plain", "text/markdown", "application/json"]:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                try:
                    with open(file_path, 'r', encoding='latin-1') as f:
                        content = f.read()
                except Exception:
                    content = "Unable to read file content (encoding issues)"
            except Exception as e:
                content = f"Unable to read file content: {str(e)}"
        else:
            content = "File content preview not supported for this file type"
        
        return {
            "success": True,
            "message": "Document retrieved successfully",
            "document_info": doc_info,
            "content": content,
            "content_preview": content[:1000] + "..." if content and len(content) > 1000 else content,
            "download_url": f"/api/documents/download/{filename}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to view document: {str(e)}"
        )

@router.delete("/delete", response_model=DocumentDeleteResponse)
async def delete_documents(filenames: List[str]):
    """
    Delete specified documents from the upload folder.
    
    Args:
        filenames: List of filenames to delete
    """
    try:
        upload_folder = get_upload_folder()
        deleted_files = []
        not_found_files = []
        error_files = []
        
        for filename in filenames:
            file_path = os.path.join(upload_folder, filename)
            
            # Security check: ensure file is within upload folder
            if not file_path.startswith(upload_folder):
                error_files.append(f"{filename}: Invalid file path")
                continue
                
            if os.path.exists(file_path) and os.path.isfile(file_path):
                try:
                    os.remove(file_path)
                    deleted_files.append(filename)
                    print(f"Deleted file: {filename}")
                except Exception as e:
                    error_files.append(f"{filename}: {str(e)}")
            else:
                not_found_files.append(filename)
        
        # Prepare response message
        message_parts = []
        if deleted_files:
            message_parts.append(f"Successfully deleted {len(deleted_files)} files")
        if not_found_files:
            message_parts.append(f"{len(not_found_files)} files not found")
        if error_files:
            message_parts.append(f"{len(error_files)} files had errors")
            
        message = "; ".join(message_parts)
        
        if error_files or not_found_files:
            # Partial success
            full_message = message
            if not_found_files:
                full_message += f"\nNot found: {', '.join(not_found_files)}"
            if error_files:
                full_message += f"\nErrors: {'; '.join(error_files)}"
            
            return DocumentDeleteResponse(
                success=len(deleted_files) > 0,
                message=full_message,
                deleted_files=deleted_files
            )
        else:
            return DocumentDeleteResponse(
                success=True,
                message=message,
                deleted_files=deleted_files
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete documents: {str(e)}"
        )

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Upload documents to the upload folder for later use.
    
    Args:
        files: List of files to upload
    """
    try:
        upload_folder = get_upload_folder()
        uploaded_files = []
        error_files = []
        
        for file in files:
            if not file:
                continue
                
            try:
                # Read file content
                file_content = await file.read()
                filename = file.filename
                
                # Generate unique filename if file already exists
                file_path = os.path.join(upload_folder, filename)
                counter = 1
                base_name, ext = os.path.splitext(filename)
                
                while os.path.exists(file_path):
                    new_filename = f"{base_name}_{counter}{ext}"
                    file_path = os.path.join(upload_folder, new_filename)
                    filename = new_filename
                    counter += 1
                
                # Save file
                with open(file_path, "wb") as f:
                    f.write(file_content)
                
                # Get file info
                doc_info = get_file_info(file_path)
                uploaded_files.append(doc_info)
                print(f"Uploaded file: {filename}")
                
            except Exception as e:
                error_files.append(f"{file.filename}: {str(e)}")
                continue
        
        # Prepare response message
        message = f"Successfully uploaded {len(uploaded_files)} files"
        if error_files:
            message += f"; {len(error_files)} files had errors: {'; '.join(error_files)}"
        
        return DocumentUploadResponse(
            success=len(uploaded_files) > 0,
            message=message,
            uploaded_files=uploaded_files
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload documents: {str(e)}"
        )

@router.delete("/clear", response_model=DocumentDeleteResponse)
async def clear_all_documents():
    """
    Clear all uploaded documents from the upload folder.
    Use with caution - this will delete all files!
    """
    try:
        upload_folder = get_upload_folder()
        deleted_files = []
        error_files = []
        
        if os.path.exists(upload_folder):
            for filename in os.listdir(upload_folder):
                file_path = os.path.join(upload_folder, filename)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                        deleted_files.append(filename)
                        print(f"Deleted file: {filename}")
                    except Exception as e:
                        error_files.append(f"{filename}: {str(e)}")
        
        message = f"Cleared {len(deleted_files)} files from upload folder"
        if error_files:
            message += f"; {len(error_files)} files had errors"
        
        return DocumentDeleteResponse(
            success=True,
            message=message,
            deleted_files=deleted_files
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear documents: {str(e)}"
        )
