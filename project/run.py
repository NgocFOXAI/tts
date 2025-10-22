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
    # Lấy port từ environment variable hoặc dùng 18000 mặc định
    port = int(os.environ.get("PORT", 18000))
    uvicorn.run("src.app.main:app", host="0.0.0.0", port=port, reload=False)
