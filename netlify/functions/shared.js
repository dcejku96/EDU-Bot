const MAX_HISTORY_MESSAGES = 20;

const KNOWN_FACULTIES = new Set([
  'ekonomi',
  'cs',
  'education',
  'philology',
  'life_sciences',
  'law',
]);

const FACULTY_TITLES = {
  ekonomi: 'Ekonomi',
  cs: 'Shkenca Kompjuterike',
  law: 'Juridik',
  education: 'Edukim',
  philology: 'Filologji',
  life_sciences: 'Shkencat e Jetës dhe Mjedisit',
};

const BASE_PROMPT = `
Rregull kryesore: Bëj VETËM një pyetje në çdo përgjigje. Prit përgjigjen e studentit para se të vazhdosh.

Rregulla:
- Mos jep zgjidhjen direkte — jep vetëm 1 hint që e drejton drejt përgjigjes
- Mos shpjego dhe mos jep informacion shtesë pa e kërkuar studenti
- Kur studenti përgjigjet sakt: konfirmo me 1 fjali të shkurtër dhe bëj pyetjen tjetër
- Kur studenti përgjigjet gabim: jep vetëm 1 hint dhe ripyet të njëjtën pyetje
- Nëse studenti nuk përgjigjet sakt 3 herë radhazi: jepja përgjigjen dhe shpjego shkurt pse
- Nëse studenti kërkon zgjidhje pa u përpjekur: ktheje te pyetja drejtuese
- Nëse studenti është i humbur: thuaj konceptin bazë me 1 fjali, pastaj pyet
- Nëse pyetja lidhet me provim/detyrë: udhëzo pa dhënë përgjigje finale
- Përgjigju gjithmonë në shqip
- Përgjigjet maksimum 2-3 fjali
`;

const FACULTY_EXTRAS = {
  ekonomi: `
Fokuso në: kosto, përfitim, eficiencë margjinale.
Kur ka formula, kërko fillimisht konceptin para llogaritjes.
`,
  cs: `
Mos jep kod të plotë.
Fokuso në logjikë algoritmike dhe debug.
`,
  education: `
Lidh me teori pedagogjike (Piaget, Vygotsky, Bloom).
Fokuso në zbatim në klasë.
`,
  philology: `
Fokuso në analizë teksti dhe kuptim gjuhësor.
Kërko interpretim nga studenti para shpjegimit.
Fol anglisht nese studenti shkruan ose kerkon pergjigje anglisht.
Fol gjermanisht nese studenti shkruan ose kerkon pergjigje gjermanisht.
`,
  life_sciences: `
Përdor metodën shkencore: hipotezë → analizë → rezultat.
Inkurajo parashikime.
`,
  law: `
Përdor strukturën IRAC (Issue, Rule, Application, Conclusion).
Inkurajo argumente pro dhe kundër.
`,
};

const QUIZ_SYSTEM_PROMPT = `Ti je një gjenerues kuizesh akademike. Bazuar në bisedën e dhënë, gjenero saktësisht 4 pyetje me zgjedhje të shumëfishta në shqip. Kthe VETËM një array JSON, pa asnjë tekst para ose pas, pa backtick-e, pa shpjegime. Formati saktësisht kështu: [ { "pyetja": "Teksti i pyetjes?", "alternativat": ["A. ...", "B. ...", "C. ...", "D. ..."], "e_sakta": "A" } ] Pyetjet duhet të jenë të lidhura drejtpërdrejt me temat e diskutuara në bisedë.
- Mos përsërit të njëjtin koncept me fjalë të ndryshme.
- Pyetjet të testojnë kuptim, jo vetëm memorizim.
- Nëse biseda është shumë e shkurtër, bazohu vetëm në faktet e diskutuara`;

function badRequest(message, statusCode = 400) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  };
}

function validateHistory(history) {
  if (!Array.isArray(history)) {
    throw new Error('Historia duhet të jetë listë.');
  }

  const valid = history.filter((msg) => {
    return (
      msg &&
      typeof msg === 'object' &&
      ['user', 'assistant'].includes(msg.role) &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0
    );
  });

  return valid;
}

function truncateHistory(history) {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }

  let truncated = history.slice(-MAX_HISTORY_MESSAGES);
  if (truncated[0] && truncated[0].role === 'assistant') {
    truncated = truncated.slice(1);
  }
  return truncated;
}

function buildPrompt(faculty) {
  const title = FACULTY_TITLES[faculty] || faculty?.charAt(0).toUpperCase() + faculty?.slice(1);
  const extra = FACULTY_EXTRAS[faculty] || '';
  return `Ti je profesor PhD në ${title}.\n\n${BASE_PROMPT}\n${extra}`;
}

function extractJsonArray(raw) {
  const match = raw.match(/\[.*\]/s);
  if (!match) {
    throw new Error(`Nuk u gjet JSON array në përgjigjen e modelit: ${raw.slice(0, 200)}`);
  }
  return match[0];
}

module.exports = {
  KNOWN_FACULTIES,
  buildPrompt,
  validateHistory,
  truncateHistory,
  badRequest,
  extractJsonArray,
  QUIZ_SYSTEM_PROMPT,
};
