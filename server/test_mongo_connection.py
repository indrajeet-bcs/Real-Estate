"""
Quick diagnostic test script to test MongoDB Atlas connectivity via Python and python-dotenv.
Usage:
    python test_mongo_connection.py
"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# 1. Load environment variables via python-dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# 2. Fetch connection string securely via os.getenv
MONGO_URI = os.getenv("MONGO_URI")

from database import connect_to_mongo, close_mongo_connection, mask_mongo_uri


async def main():
    print("=" * 60)
    print("  MongoDB Atlas Connection Diagnostic (Python / Motor / pymongo)")
    print("=" * 60)
    print(f"Loaded MONGO_URI: {mask_mongo_uri(MONGO_URI)}")

    if not MONGO_URI:
        print("\n[ERROR] MONGO_URI is not set in .env file!")
        sys.exit(1)

    print("\nAttempting connection to MongoDB Atlas...")
    try:
        client = await connect_to_mongo()
        print("\n[SUCCESS] Connection to MongoDB Atlas established successfully!")
        server_info = await client.server_info()
        print(f"MongoDB Server Version: {server_info.get('version')}")
        await close_mongo_connection()
        print("\nConnection closed cleanly.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAILED] Could not connect to MongoDB Atlas.")
        print(f"Details: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
