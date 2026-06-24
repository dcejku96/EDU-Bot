import json
import re
import logging
from groq import Groq, APIError, APIConnectionError, RateLimitError
 
from config import GROQ_API_KEY, GROQ_MODEL, MAX_HISTORY_MESSAGES
from prompts import build_prompt, QUIZ_SYSTEM_PROMPT
 
logger = logging.getLogger(__name__)
 
_client = Groq(api_key=GROQ_API_KEY)
 
 
class AIServiceError(Exception):
    pass
 
 
def _truncate_history(history: list[dict]) -> list[dict]:
    if len(history) <= MAX_HISTORY_MESSAGES:
        return history
    
    truncated = history[-MAX_HISTORY_MESSAGES:]
    if truncated and truncated[0].get("role") == "assistant":
        truncated = truncated[1:]
    return truncated
 
 
def _validate_message(msg: object) -> bool:
    return (
        isinstance(msg, dict)
        and msg.get("role") in ("user", "assistant")
        and isinstance(msg.get("content"), str)
        and len(msg["content"].strip()) > 0
    )
 
 
def validate_history(history: list) -> list[dict]:
    if not isinstance(history, list):
        raise ValueError("Historia duhet të jetë listë.")
    
    valid = [m for m in history if _validate_message(m)]
    
    if len(valid) != len(history):
        dropped = len(history) - len(valid)
        logger.warning("U hoqën %d mesazhe të pavlefshme nga historia.", dropped)
    
    return valid
 
 
def get_chat_response(history: list[dict], faculty: str) -> str:
    system_prompt = build_prompt(faculty)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_truncate_history(history))
 
    try:
        completion = _client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=512,  
        )
        return completion.choices[0].message.content
 
    except RateLimitError:
        logger.warning("Eshtë arritur limiti i kërkesave.")
        raise AIServiceError("Sistemi është i ngarkuar. Provo sërish pas pak sekondash.")
    except APIConnectionError:
        logger.error("Nuk mund të lidhem me Groq API.")
        raise AIServiceError("Problem me lidhjen. Kontrollo internetin dhe provo sërish.")
    except APIError as e:
        logger.error("Groq API gabim: %s", e)
        raise AIServiceError("Gabim i brendshëm i shërbimit AI.")
 
 
def _extract_json_array(raw: str) -> str:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Nuk u gjet JSON array në përgjigjen e modelit: {raw[:200]}")
    return match.group()
 
 
def generate_quiz(history: list[dict]) -> list[dict]:
    conversation_text = "\n".join(
        f"{'Studenti' if m['role'] == 'user' else 'Profesori'}: {m['content']}"
        for m in history
    )
 
    messages = [
        {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
        {"role": "user", "content": f"Biseda:\n{conversation_text}"},
    ]
 
    try:
        completion = _client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.4,  
            max_tokens=1024,
        )
        raw = completion.choices[0].message.content.strip()
 
    except RateLimitError:
        raise AIServiceError("Sistemi është i ngarkuar. Provo sërish pas pak sekondash.")
    except APIError as e:
        logger.error("Groq API gabim gjatë kuizit: %s", e)
        raise AIServiceError("Gabim gjatë gjenerimit të kuizit.")
 
    try:
        json_str = _extract_json_array(raw)
        questions = json.loads(json_str)
    except (ValueError, json.JSONDecodeError) as e:
        logger.error("JSON parsing dështoi. Raw: %s | Gabim: %s", raw[:300], e)
        raise ValueError("Modeli ktheu përgjigje të paparsueshme. Provo sërish.")
 
    if not isinstance(questions, list) or len(questions) == 0:
        raise ValueError("Kuizi është bosh ose ka format të gabuar.")

    return questions