from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "WriteForge"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    database_url: str = "sqlite+aiosqlite:///./writeforge.db"
    
    # Storage mode: database | obsidian
    storage_mode: str = "database"
    obsidian_vault_path: str = "./vault"
    
    # OAuth providers
    google_client_id: str | None = None
    google_client_secret: str | None = None
    
    # Encryption key for API keys at rest (generate with Fernet.generate_key())
    encryption_key: str | None = None
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
