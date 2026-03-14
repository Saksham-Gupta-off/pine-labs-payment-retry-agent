import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
PINELABS_CLIENT_ID = os.getenv("PINELABS_CLIENT_ID", "")
PINELABS_CLIENT_SECRET = os.getenv("PINELABS_CLIENT_SECRET", "")
PINELABS_BASE_URL = os.getenv("PINELABS_BASE_URL", "https://pluraluat.v2.pinepg.in")
