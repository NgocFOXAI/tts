import os
import time
from pathlib import Path
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class LogCleaner:
    def __init__(self, log_dir: str = "logs", retention_days: int = 3):
        self.log_dir = Path(log_dir)
        self.retention_days = retention_days
        
    def clean_old_logs(self):
        """Xóa các file log cũ hơn retention_days"""
        try:
            if not self.log_dir.exists():
                return
            
            cutoff_time = time.time() - (self.retention_days * 24 * 60 * 60)
            deleted_count = 0
            
            for log_file in self.log_dir.glob("*.log"):
                try:
                    file_mtime = os.path.getmtime(log_file)
                    if file_mtime < cutoff_time:
                        log_file.unlink()
                        deleted_count += 1
                        logger.info(f"Deleted old log file: {log_file.name}")
                except Exception as e:
                    logger.error(f"Error deleting log file {log_file.name}: {e}")
            
            if deleted_count > 0:
                logger.info(f"Cleaned {deleted_count} old log files (older than {self.retention_days} days)")
                
        except Exception as e:
            logger.error(f"Error during log cleanup: {e}")
