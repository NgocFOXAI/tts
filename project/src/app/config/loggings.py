"""
Centralized logging configuration with daily rotation and structured formatting
"""
import logging
import sys
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime

# Define log levels
LOG_LEVEL = logging.INFO

# Define log format
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Console format (shorter for terminal readability)
CONSOLE_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

# Define log directory
LOG_DIR = Path(__file__).parent.parent.parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


class UTFTimedRotatingFileHandler(TimedRotatingFileHandler):
    """Custom handler to ensure UTF-8 encoding on Windows"""
    def __init__(self, *args, **kwargs):
        kwargs['encoding'] = 'utf-8'
        super().__init__(*args, **kwargs)


def setup_logger(name: str = None) -> logging.Logger:
    """
    Setup and return a logger with file and console handlers
    
    Args:
        name: Logger name (use __name__ from calling module)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name or __name__)
    
    # Prevent duplicate handlers if logger already configured
    if logger.handlers:
        return logger
    
    logger.setLevel(LOG_LEVEL)
    logger.propagate = False
    
    # File Handler - Daily rotation, keep 30 days
    log_file = LOG_DIR / "app.log"
    file_handler = UTFTimedRotatingFileHandler(
        filename=str(log_file),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    file_handler.setLevel(LOG_LEVEL)
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    file_handler.suffix = "%Y-%m-%d"  # Format: app.log.2025-11-06
    logger.addHandler(file_handler)
    
    # Console Handler - Only INFO and above
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(LOG_LEVEL)
    console_handler.setFormatter(logging.Formatter(CONSOLE_FORMAT, DATE_FORMAT))
    logger.addHandler(console_handler)
    
    # Error File Handler - Separate file for errors
    error_log_file = LOG_DIR / "error.log"
    error_handler = UTFTimedRotatingFileHandler(
        filename=str(error_log_file),
        when='midnight',
        interval=1,
        backupCount=60,  # Keep errors longer
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    error_handler.suffix = "%Y-%m-%d"
    logger.addHandler(error_handler)
    
    return logger


def setup_uvicorn_logging():
    """Configure uvicorn and FastAPI logging"""
    # Get uvicorn loggers
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_error = logging.getLogger("uvicorn.error")
    uvicorn = logging.getLogger("uvicorn")
    
    # Suppress asyncio warnings about unhandled tasks on Windows
    asyncio_logger = logging.getLogger("asyncio")
    asyncio_logger.setLevel(logging.ERROR)
    
    # Create custom filter for known Windows network errors
    class WindowsNetworkErrorFilter(logging.Filter):
        def filter(self, record):
            # Suppress WinError 64 (network name no longer available)
            if "WinError 64" in str(record.msg):
                return False
            if "The specified network name is no longer available" in str(record.msg):
                return False
            if "Task exception was never retrieved" in str(record.msg):
                # Check if it's related to OSError network issues
                if hasattr(record, 'exc_info') and record.exc_info:
                    exc_type, exc_value, _ = record.exc_info
                    if isinstance(exc_value, OSError) and getattr(exc_value, 'winerror', None) == 64:
                        return False
            return True
    
    # Add filter to uvicorn error logger
    windows_filter = WindowsNetworkErrorFilter()
    
    # Configure access log
    access_log_file = LOG_DIR / "access.log"
    access_handler = UTFTimedRotatingFileHandler(
        filename=str(access_log_file),
        when='midnight',
        interval=1,
        backupCount=7,  # Keep 7 days of access logs
        encoding='utf-8'
    )
    access_handler.setLevel(logging.INFO)
    access_handler.setFormatter(logging.Formatter(
        "%(asctime)s | ACCESS | %(message)s",
        DATE_FORMAT
    ))
    access_handler.suffix = "%Y-%m-%d"
    
    # Clear existing handlers and add new one
    uvicorn_access.handlers.clear()
    uvicorn_access.addHandler(access_handler)
    uvicorn_access.propagate = False
    
    # Configure error log
    uvicorn_error.handlers.clear()
    uvicorn.handlers.clear()
    
    # Add handlers to uvicorn loggers
    for logger in [uvicorn_error, uvicorn]:
        logger.setLevel(LOG_LEVEL)
        logger.addFilter(windows_filter)
        
        # File handler
        file_handler = UTFTimedRotatingFileHandler(
            filename=str(LOG_DIR / "app.log"),
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        file_handler.setLevel(LOG_LEVEL)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        file_handler.suffix = "%Y-%m-%d"
        file_handler.addFilter(windows_filter)
        logger.addHandler(file_handler)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(LOG_LEVEL)
        console_handler.setFormatter(logging.Formatter(CONSOLE_FORMAT, DATE_FORMAT))
        console_handler.addFilter(windows_filter)
        logger.addHandler(console_handler)
        
        logger.propagate = False


def get_logger(name: str = None) -> logging.Logger:
    """
    Convenience function to get a configured logger
    
    Usage:
        from app.config.loggings import get_logger
        logger = get_logger(__name__)
        logger.info("Application started")
    
    Args:
        name: Logger name (use __name__)
        
    Returns:
        Configured logger instance
    """
    return setup_logger(name)


# Initialize root logger on import
_root_logger = setup_logger("app")
_root_logger.info(f"Logging system initialized - Log directory: {LOG_DIR}")
