const { KNOWN_FACULTIES, buildPrompt, validateHistory, truncateHistory, badRequest } = require('./shared');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return badRequest('Metoda e pavlefshme.', 405);
  }

  if (!GROQ_API_KEY) {
    return badRequest('GROQ_API_KEY nuk është konfiguruar në Netlify.', 500);
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (error) {
    return badRequest('Kërkohet JSON i vlefshëm.');
  }

  const faculty = String(data.faculty || '').trim();
  if (!KNOWN_FACULTIES.has(faculty)) {
    return badRequest(`Fakultet i panjohur: '${faculty}'.`);
  }

  let history;
  try {
    history = validateHistory(data.history || []);
  } catch (error) {
    return badRequest(error.message);
  }

  if (!history.length) {
    return badRequest('Historia e bisedës është bosh ose e pavlefshme.');
  }

  const systemPrompt = buildPrompt(faculty);
  const messages = [{ role: 'system', content: systemPrompt }, ...truncateHistory(history)];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const message = result.error?.message || 'Gabim i brendshëm i shërbimit AI.';
      return badRequest(message, response.status >= 500 ? 503 : 400);
    }

    const reply = result.choices?.[0]?.message?.content || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    return badRequest('Problem me lidhjen. Kontrollo internetin dhe provo sërish.', 503);
  }
};
