import os
from pathlib import Path
from dotenv import load_dotenv
 

_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
 
 
def get_required_env(key: str) -> str:
    """Merr environment variable ose hedh gabim të qartë."""
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Environment variable '{key}' mungon. "
            f"Vendose në .env ose si variabël sistemi."
        )
    return value
 
 
GROQ_API_KEY: str = get_required_env("GROQ_API_KEY")
GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
 
MAX_HISTORY_MESSAGES: int = 20
 
KNOWN_FACULTIES = frozenset([
    "ekonomi",
    "cs",
    "education",
    "philology",
    "life_sciences",
    "law",
])

FACULTY_TITLES = {
    "ekonomi":       "Ekonomi",
    "cs":            "Shkenca Kompjuterike",
    "law":           "Juridik",
    "education":     "Edukim",
    "philology":     "Filologji",
    "life_sciences": "Shkencat e Jetës dhe Mjedisit",
}