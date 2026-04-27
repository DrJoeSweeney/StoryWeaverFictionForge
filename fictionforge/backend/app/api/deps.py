from app.services.storage import get_storage
from app.services.storage.base import BaseStorage


def get_storage_dep() -> BaseStorage:
    return get_storage()
