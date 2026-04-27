from app.services.storage.file_storage import FileStorage

_file_storage: FileStorage | None = None


def get_storage() -> FileStorage:
    global _file_storage
    if _file_storage is None:
        _file_storage = FileStorage("./data/content")
    return _file_storage


def reset_storage() -> None:
    global _file_storage
    _file_storage = None
