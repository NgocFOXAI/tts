"""
Utility functions for consistent logging across the application
"""
from typing import Any, Optional
from ..config.loggings import get_logger

def log_api_call(logger, endpoint: str, method: str = "POST", **kwargs):
    """Log API call with standardized format"""
    params = " | ".join([f"{k}={v}" for k, v in kwargs.items()])
    logger.info(f"API [{method}] {endpoint} | {params}")

def log_file_operation(logger, operation: str, filename: str, details: Optional[str] = None):
    """Log file operations (upload, delete, process)"""
    msg = f"FILE [{operation.upper()}] {filename}"
    if details:
        msg += f" | {details}"
    logger.info(msg)

def log_cache_operation(logger, operation: str, key: str, details: Optional[str] = None):
    """Log cache operations (hit, miss, store)"""
    msg = f"CACHE [{operation.upper()}] {key}"
    if details:
        msg += f" | {details}"
    logger.info(msg)

def log_automation_start(logger, automation_type: str, details: dict):
    """Log automation task start"""
    details_str = " | ".join([f"{k}={v}" for k, v in details.items()])
    logger.info(f"AUTOMATION [START] {automation_type} | {details_str}")

def log_automation_complete(logger, automation_type: str, duration: float, result: Optional[str] = None):
    """Log automation task completion"""
    msg = f"AUTOMATION [COMPLETE] {automation_type} | Duration: {duration:.2f}s"
    if result:
        msg += f" | Result: {result}"
    logger.info(msg)

def log_automation_error(logger, automation_type: str, error: Exception, duration: Optional[float] = None):
    """Log automation task error"""
    msg = f"AUTOMATION [ERROR] {automation_type} | Error: {str(error)}"
    if duration:
        msg += f" | Duration: {duration:.2f}s"
    logger.error(msg, exc_info=True)

def log_processing_time(logger, operation: str, duration: float, details: Optional[dict] = None):
    """Log operation processing time"""
    msg = f"PERFORMANCE [{operation}] {duration:.2f}s"
    if details:
        details_str = " | ".join([f"{k}={v}" for k, v in details.items()])
        msg += f" | {details_str}"
    logger.info(msg)

def log_model_usage(logger, model: str, operation: str, tokens: Optional[int] = None):
    """Log AI model usage"""
    msg = f"MODEL [{model}] {operation}"
    if tokens:
        msg += f" | Tokens: {tokens:,}"
    logger.info(msg)

def log_validation_error(logger, field: str, value: Any, reason: str):
    """Log validation errors"""
    logger.warning(f"VALIDATION [ERROR] Field: {field} | Value: {value} | Reason: {reason}")

def log_business_event(logger, event_type: str, details: dict):
    """Log business-level events"""
    details_str = " | ".join([f"{k}={v}" for k, v in details.items()])
    logger.info(f"EVENT [{event_type}] {details_str}")
