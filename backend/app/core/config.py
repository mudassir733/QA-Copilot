import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY")
    GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")
    MISTRAL_API_KEY: str | None = os.getenv("MISTRAL_API_KEY")

settings = Settings()