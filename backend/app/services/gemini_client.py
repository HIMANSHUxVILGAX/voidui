import os
from dotenv import load_dotenv
from app.services.ai_engine_service import generate_lumen_response, generate_superforge_response, PERSONAS, key_manager

load_dotenv()

# Securely load the API key from environment
api_key = os.getenv("GEMINI_API_KEY")

__all__ = ["api_key", "generate_lumen_response",
           "generate_superforge_response", "PERSONAS", "key_manager"]
