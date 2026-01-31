from dotenv import load_dotenv

# Load .env BEFORE importing config (which reads env vars at import time)
load_dotenv()

from . import config  # noqa: E402 - must load dotenv first

settings = config.Settings()
