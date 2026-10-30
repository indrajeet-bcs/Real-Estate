import logging
import os
import re
from typing import Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("database")

# 1. Load environment variables securely via python-dotenv
# Check server/.env first, then fallback to current working directory
_current_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_current_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

# 2. Fetch the cloud connection string securely using os.getenv("MONGO_URI")
MONGO_URI: Optional[str] = os.getenv("MONGO_URI")

# Global client reference
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def mask_mongo_uri(uri: Optional[str]) -> str:
    """
    Mask sensitive credentials in the MongoDB connection URI for secure logging.
    Example: mongodb+srv://user:secret@cluster.mongodb.net/ -> mongodb+srv://user:*****@cluster.mongodb.net/
    """
    if not uri:
        return "(not configured)"
    return re.sub(r"//([^:]+):([^@]+)@", r"//\1:*****@", uri)


async def connect_to_mongo() -> AsyncIOMotorClient:
    """
    Establishes connection to MongoDB Atlas or local MongoDB instance on app startup.
    Validates connection with a ping command and includes detailed error handling.
    """
    global _client, _db

    # Re-check os.getenv in case environment was loaded dynamically
    connection_uri = os.getenv("MONGO_URI") or MONGO_URI

    if not connection_uri:
        error_msg = (
            "[db] MongoDB connection failed: MONGO_URI environment variable is missing. "
            "Please define MONGO_URI in your .env file."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info(f"[db] Connecting to MongoDB: {mask_mongo_uri(connection_uri)}")

    try:
        # Create asynchronous client with timeout for cluster server selection
        _client = AsyncIOMotorClient(
            connection_uri,
            serverSelectionTimeoutMS=8000,
            connectTimeoutMS=8000,
        )

        # Ping the cluster to verify connectivity immediately at startup
        logger.info("[db] Verifying connection to MongoDB Atlas...")
        ping_result = await _client.admin.command("ping")

        # Resolve default database name from URI or fallback
        db_name = "real_estate_crm"
        try:
            default_db = _client.get_default_database()
            if default_db is not None and default_db.name:
                db_name = default_db.name
        except Exception:
            pass

        _db = _client[db_name]
        logger.info(
            f"[db] MongoDB connected successfully! Database='{_db.name}', Ping response={ping_result}"
        )
        return _client

    except ServerSelectionTimeoutError as e:
        logger.error(f"[db] Connection timeout: Unable to reach MongoDB cluster: {e}")
        logger.error(
            "[db] [Atlas Hint] Common cause: Client IP address is not whitelisted. "
            "Add your IP to MongoDB Atlas Console -> Network Access -> IP Access List (or allow 0.0.0.0/0 for testing)."
        )
        await close_mongo_connection()
        raise

    except OperationFailure as e:
        logger.error(f"[db] MongoDB operation failed: {e}")
        if "Authentication failed" in str(e) or "bad auth" in str(e):
            logger.error(
                "[db] [Atlas Hint] Authentication failed: Check your database username and password in MONGO_URI."
            )
        await close_mongo_connection()
        raise

    except ConfigurationError as e:
        logger.error(f"[db] MongoDB configuration error: {e}")
        logger.error(
            "[db] [Atlas Hint] Please verify the syntax of your MONGO_URI connection string."
        )
        await close_mongo_connection()
        raise

    except ConnectionFailure as e:
        logger.error(f"[db] MongoDB connection failure: {e}")
        await close_mongo_connection()
        raise

    except Exception as e:
        logger.error(f"[db] Unexpected error connecting to MongoDB: {e}")
        await close_mongo_connection()
        raise


async def close_mongo_connection() -> None:
    """
    Gracefully close MongoDB connection on shutdown.
    """
    global _client, _db
    if _client is not None:
        logger.info("[db] Closing MongoDB connection...")
        _client.close()
        _client = None
        _db = None
        logger.info("[db] MongoDB connection closed.")


def get_database(db_name: Optional[str] = None) -> AsyncIOMotorDatabase:
    """
    Helper function to get database instance.
    """
    global _client, _db
    if _client is None:
        raise RuntimeError("Database client is not connected. Call connect_to_mongo() first.")
    if db_name:
        return _client[db_name]
    if _db is not None:
        return _db
    return _client["real_estate_crm"]
