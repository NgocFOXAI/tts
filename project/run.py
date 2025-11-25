import sys
import os
import io

# Set UTF-8 encoding for stdout/stderr to handle emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to Python path
project_root = os.path.dirname(__file__)
src_path = os.path.join(project_root, 'src')
sys.path.insert(0, project_root)
sys.path.insert(0, src_path)

from src.app.main import app

if __name__ == "__main__":
    import uvicorn
    import asyncio
    
    # Lấy port từ environment variable hoặc dùng 18001 mặc định
    port = int(os.environ.get("PORT", 18001))
    
    # Set Windows-specific event loop policy
    # ProactorEventLoop is required for subprocess operations (Playwright)
    # Note: ProactorEventLoop is the default in Python 3.8+ on Windows
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Configure uvicorn with custom logging
    uvicorn.run(
        "src.app.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_config=None,  # Disable default logging, use our custom config
        access_log=True,
        timeout_keep_alive=30,  # Reduce keep-alive timeout to prevent stale connections
        limit_concurrency=1000,  # Limit concurrent connections
        backlog=2048  # Socket backlog size
    )
