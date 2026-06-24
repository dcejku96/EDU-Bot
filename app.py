import logging
from flask import Flask, request, jsonify, render_template
 
from config import KNOWN_FACULTIES
from services import (
    AIServiceError,
    validate_history,
    get_chat_response,
    generate_quiz,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
 
app = Flask(__name__)
 

def _bad_request(message: str, status: int = 400):
    return jsonify({"error": message}), status
 

@app.route("/")
def home():
    return render_template("index.html")
 
 
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)
    if data is None:
        return _bad_request("Kërkohet JSON i vlefshëm.")
 
    faculty = data.get("faculty", "").strip()
    if faculty not in KNOWN_FACULTIES:
        return _bad_request(f"Fakultet i panjohur: '{faculty}'.")
 
    raw_history = data.get("history", [])
    try:
        history = validate_history(raw_history)
    except ValueError as e:
        return _bad_request(str(e))
 
    if not history:
        return _bad_request("Historia e bisedës është bosh ose e pavlefshme.")
 
    try:
        reply = get_chat_response(history, faculty)
        return jsonify({"reply": reply})
    except AIServiceError as e:
        return _bad_request(str(e), status=503)
 
 
@app.route("/quiz", methods=["POST"])
def quiz():
    data = request.get_json(silent=True)
    if data is None:
        return _bad_request("Kërkohet JSON i vlefshëm.")
 
    raw_history = data.get("history", [])
    try:
        history = validate_history(raw_history)
    except ValueError as e:
        return _bad_request(str(e))
 
    if len(history) < 2:
        return _bad_request(
            "Duhet të kesh së paku një shkëmbim të plotë me EDU Bot-in "
            "para se të gjenerosh kuizin."
        )
 
    try:
        questions = generate_quiz(history)
        return jsonify({"questions": questions})
    except AIServiceError as e:
        return _bad_request(str(e), status=503)
    except ValueError as e:
        return _bad_request(str(e), status=502)
 

 
if __name__ == "__main__":
    app.run(debug=False, port=5001)