function buildRagPrompt({ question, sources = [], ownerName, email, waNumberOwner }) {
  const safeOwner = ownerName || 'Saigon Web Designer';
  const safeEmail = email || 'infininesmartsolutions@gmail.com';
  const safeWa = waNumberOwner || '254759240255';

  const numberedSources = (sources || [])
    .map((source, index) => {
      const filename = source.source || source.filename || 'site';
      const score = source.score ? ` (score=${Number(source.score).toFixed(3)})` : '';
      const snippet = String(source.text || '').replace(/\s+/g, ' ').trim().slice(0, 350);
      return `[${index + 1}] ${filename}${score}: ${snippet}`;
    })
    .join('\n\n');

  return [
    'You are a concise site assistant.',
    'Answer in 2–4 lines, direct and friendly.',
    'Use only the provided sources and the site facts.',
    'Cite source names/pages like `terms.pdf#page1` or `site#home` when possible.',
    'Do not reveal admin secrets, API keys, or backend details.',
    'If no useful match is found, use this exact fallback line:',
    `"I couldn't find that in the uploaded files or the site — would you like to message us on WhatsApp? https://wa.me/${safeWa}"`,
    '',
    'Fixed facts:',
    `Owner: ${safeOwner}`,
    `WhatsApp owner/web designer: 0759240255 (https://wa.me/${safeWa})`,
    `CEO / main contact: 0711922007 (https://wa.me/254711922007)`,
    `Email: ${safeEmail}`,
    '',
    'SOURCES:',
    numberedSources || 'No relevant source found.',
    '',
    'QUESTION:',
    question
  ].join('\n');
}

module.exports = { buildRagPrompt };
