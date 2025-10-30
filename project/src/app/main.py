from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import config_router, generate_router, tts_router, audio_router, document_management_router
from .api.models import router as models_router
from .api.audio_generation import router as audio_generation_router
from .api.foxai import router as foxai_router
from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager
from .utils.log_cleaner import LogCleaner

# Load environment variables from .env file
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Clean old logs
    log_cleaner = LogCleaner(log_dir="logs", retention_days=3)
    log_cleaner.clean_old_logs()
    yield
    # Shutdown: cleanup if needed

app = FastAPI(
    title="Text-to-Speech & Text Generation API",
    description="API cho text generation và text-to-speech với user customization",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware - Allow all origins for maximum compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Include routers with /api prefix
app.include_router(config_router, prefix="/api")
app.include_router(generate_router, prefix="/api")
app.include_router(tts_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(audio_generation_router, prefix="/api")
app.include_router(foxai_router, prefix="/api")
app.include_router(audio_router, prefix="/api")
app.include_router(document_management_router, prefix="/api")