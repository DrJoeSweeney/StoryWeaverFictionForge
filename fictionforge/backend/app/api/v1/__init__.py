from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as projects_router
from app.api.v1.documents import router as documents_router
from app.api.v1.ai_providers import router as ai_providers_router
from app.api.v1.writing import router as writing_router
from app.api.v1.characters import router as characters_router
from app.api.v1.story_bible import router as story_bible_router
from app.api.v1.canvas import router as canvas_router
from app.api.v1.skills import router as skills_router
from app.api.v1.export import router as export_router
from app.api.v1.story_engine import router as story_engine_router
from app.api.v1.style_guide import router as style_guide_router
from app.api.v1.ai_activity_logs import router as ai_activity_logs_router
from app.api.v1.embeddings import router as embeddings_router

router = APIRouter(prefix="/v1")

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(projects_router, prefix="/projects", tags=["projects"])
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(ai_providers_router, prefix="/ai-providers", tags=["ai-providers"])
router.include_router(writing_router, prefix="/writing", tags=["writing"])
router.include_router(characters_router, prefix="/characters", tags=["characters"])
router.include_router(story_bible_router, prefix="/story-bible", tags=["story-bible"])
router.include_router(canvas_router, prefix="/canvas", tags=["canvas"])
router.include_router(skills_router, prefix="/skills", tags=["skills"])
router.include_router(export_router, prefix="/export", tags=["export"])
router.include_router(story_engine_router, prefix="/story-engine", tags=["story-engine"])
router.include_router(style_guide_router, prefix="/style-guide", tags=["style-guide"])
router.include_router(ai_activity_logs_router, prefix="/ai-activity-logs", tags=["ai-activity-logs"])
router.include_router(embeddings_router, prefix="/embeddings", tags=["embeddings"])
