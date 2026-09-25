function chunkText(text, chunkSize = 500, overlapSize = 120) {
  if (!text || typeof text !== 'string') return [];
  const safe = text.replace(/\r/g, '').trim();
  if (!safe) return [];

  const size = Math.max(200, Number(chunkSize) || 500);
  const overlap = Math.min(Math.max(20, Number(overlapSize) || 120), Math.floor(size * 0.35));

  const chunks = [];
  let start = 0;

  while (start < safe.length) {
    let end = start + size;
    if (end > safe.length) end = safe.length;

    const segment = safe.slice(start, end).trim();
    if (!segment) break;

    chunks.push({
      text: segment,
      startChar: start,
      endChar: end
    });

    if (end >= safe.length) break;
    start = end - overlap;
    if (start <= 0) start = end;
  }

  return chunks;
}

module.exports = { chunkText };
