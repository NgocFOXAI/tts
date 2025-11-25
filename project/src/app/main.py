from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import config_router, generate_router, tts_router, audio_router, document_management_router
from .api.models import router as models_router
from .api.audio_generation import router as audio_generation_router
from .api.foxai import router as foxai_router
from .api.claude import router as claude_router
from dotenv import load_dotenv
import os
from pathlib import Path
from contextlib import asynccontextmanager
from .utils.log_cleaner import LogCleaner
from .config.loggings import get_logger, setup_uvicorn_logging
import asyncio
import sys

# Load environment variables from .env file
load_dotenv()

# Initialize logging
logger = get_logger(__name__)
setup_uvicorn_logging()

# Set Windows-specific event loop policy
# ProactorEventLoop is required for subprocess operations (Playwright)
if sys.platform == 'win32':
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        logger.info("Using WindowsProactorEventLoopPolicy for subprocess support (Playwright)")
    except Exception as e:
        logger.warning(f"Could not set WindowsProactorEventLoopPolicy: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=" * 80)
    logger.info("🚀 Application starting up...")
    logger.info(f"Environment: {os.getenv('ENV', 'production')}")
    logger.info(f"Port: {os.getenv('PORT', '18001')}")
    
    # Clean old logs
    log_cleaner = LogCleaner(log_dir="logs", retention_days=7)
    log_cleaner.clean_old_logs()
    
    logger.info("✅ Application startup complete")
    logger.info("=" * 80)
    
    yield
    
    # Shutdown
    logger.info("=" * 80)
    logger.info("🛑 Application shutting down...")
    logger.info("=" * 80)

app = FastAPI(
    title="Text-to-Speech & Text Generation API",
    description="API cho text generation và text-to-speech với user customization",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware to handle connection errors gracefully
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class ConnectionErrorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except (OSError, ConnectionError, ConnectionResetError) as e:
            # Log the error but don't crash the server
            if isinstance(e, OSError) and e.winerror == 64:
                logger.warning(f"Client disconnected abruptly: {e}")
            else:
                logger.warning(f"Connection error: {e}")
            # Return a generic response since client is already gone
            return Response(status_code=499, content="Client Closed Request")
        except Exception as e:
            logger.error(f"Unexpected error in request handling: {e}", exc_info=True)
            raise

app.add_middleware(ConnectionErrorMiddleware)

# Add CORS middleware - Allow all origins for maximum compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Mount static files
static_dir = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include routers with /api prefix
app.include_router(config_router, prefix="/api")
app.include_router(generate_router, prefix="/api")  # AI Chat with hardcoded config
app.include_router(tts_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(audio_generation_router, prefix="/api")
app.include_router(foxai_router, prefix="/api")
app.include_router(audio_router, prefix="/api")
app.include_router(document_management_router, prefix="/api")
app.include_router(claude_router, prefix="/api")