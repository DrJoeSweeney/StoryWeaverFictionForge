from app.config import get_settings
from app.services.storage.file_storage import FileStorage
from functools import lru_cache

settings = get_settings()

_file_storage: FileStorage | None = None


def get_storage() -> FileStorage:
    global _file_storage
    if _file_storage is None:
        if settings.storage_mode == "obsidian":
            _file_storage = FileStorage(settings.obsidian_vault_path)
        else:
            _file_storage = FileStorage("./data/content")
    return _file_storage


def reset_storage() -> None:
    global _file_storage
    _file_storage = None
