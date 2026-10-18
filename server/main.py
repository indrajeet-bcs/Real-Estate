import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import (
    connect_to_mongo,
    close_mongo_connection,
    get_database,
    mask_mongo_uri,
    MONGO_URI,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fastapi_server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager:
    - On startup: Connect to MongoDB Atlas and verify connection with ping.
    - On shutdown: Close connection gracefully.
    """
    logger.info("[app] Starting up FastAPI backend...")
    logger.info(f"[app] Active MONGO_URI: {mask_mongo_uri(MONGO_URI)}")

    try:
        await connect_to_mongo()
        logger.info("[app] Database connection successfully established on startup.")
    except Exception as e:
        logger.error(f"[app] Startup failed: Could not connect to database: {e}")
        # Note: raising will prevent the app from serving requests with a broken database
        raise e

    yield

    logger.info("[app] Shutting down FastAPI backend...")
    await close_mongo_connection()


app = FastAPI(
    title="Real Estate CRM API",
    version="1.0.0",
    description="Multi-tenant Real Estate CRM — FastAPI + MongoDB Atlas Backend",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Real Estate CRM API (FastAPI)",
        "database": "MongoDB Atlas",
    }


@app.get("/api/health")
async def health_check():
    """
    Health check endpoint that verifies database ping.
    """
    try:
        db = get_database()
        ping_res = await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "ping": ping_res,
        }
    except Exception as e:
        logger.error(f"[app] Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Database unreachable: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.getenv("PORT", "5001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
