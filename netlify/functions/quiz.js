const { validateHistory, badRequest, extractJsonArray, QUIZ_SYSTEM_PROMPT } = require('./shared');

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

  let history;
  try {
    history = validateHistory(data.history || []);
  } catch (error) {
    return badRequest(error.message);
  }

  if (history.length < 2) {
    return badRequest('Duhet të kesh së paku një shkëmbim të plotë me EDU Bot-in para se të gjenerosh kuizin.');
  }

  const conversationText = history
    .map((message) => `${message.role === 'user' ? 'Studenti' : 'Profesori'}: ${message.content}`)
    .join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: QUIZ_SYSTEM_PROMPT },
          { role: 'user', content: `Biseda:\n${conversationText}` },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      const message = result.error?.message || 'Gabim gjatë gjenerimit të kuizit.';
      return badRequest(message, response.status >= 500 ? 503 : 400);
    }

    const raw = result.choices?.[0]?.message?.content?.trim() || '';
    let questions;
    try {
      const jsonString = extractJsonArray(raw);
      questions = JSON.parse(jsonString);
    } catch (error) {
      return badRequest('Modeli ktheu përgjigje të paparsueshme. Provo sërish.', 502);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return badRequest('Kuizi është bosh ose ka format të gabuar.', 502);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    };
  } catch (error) {
    return badRequest('Problem me lidhjen. Kontrollo internetin dhe provo sërish.', 503);
  }
};
