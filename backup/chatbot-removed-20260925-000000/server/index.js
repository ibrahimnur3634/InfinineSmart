require('dotenv').config();

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const { parseUploadedFile } = require('./utils/parseFile');
const { chunkText } = require('./utils/chunker');
const { embedTexts, upsertVectors, searchSimilar } = require('./utils/embedAndUpsert');
const { buildRagPrompt } = require('./promptTemplates');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || 'upload').replace(/[^\w.-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/widget', express.static(path.join(__dirname, '..', 'client')));

const sessionMap = new Map();
const localKnowledgeStore = [];

function ensureSession(sessionId) {
  const id = sessionId || 'default';
  if (!sessionMap.has(id)) sessionMap.set(id, { fileIds: [] });
  return sessionMap.get(id);
}

function normalizeMessage(text) {
  return String(text || '').trim();
}

function toSseData(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function createFallbackPayload(waNumber) {
  return {
    fallback: true,
    wa_link: `https://wa.me/${waNumber}`,
    answer: `I couldn't find that in the uploaded files or the site — would you like to message us on WhatsApp? https://wa.me/${waNumber}`,
    sources: []
  };
}

function answerQuestionLocally(message) {
  const q = normalizeMessage(message).toLowerCase();

  if (!q) return null;

  if (/who owns this site|who is the owner|site owner|website owner/.test(q)) {
    return 'The site is owned by Saigon Web Designer.';
  }

  if (/contact|reach|call|phone|whatsapp|email|message|support|ceo|main contact|owner|web designer/.test(q)) {
    return 'WhatsApp (owner/web designer): 0759240255 — https://wa.me/254759240255. WhatsApp (CEO/main contact): 0711922007 — https://wa.me/254711922007. Email: infininesmartsolutions@gmail.com.';
  }

  if (/what services|services|what do you offer|offerings|help with|what can you do/.test(q)) {
    return 'We offer government & eCitizen support, KRA & tax help, HELB support, CV writing, printing/scanning/typing, business registration/design, and computer troubleshooting.';
  }

  if (/helb|higher education loan|student loan/.test(q)) {
    return 'We can help with HELB-related support and student loan application guidance.';
  }

  if (/kra|tax|nil|returns|pin/.test(q)) {
    return 'Yes, we offer KRA and tax support including PIN assistance and NIL return guidance.';
  }

  const localHits = localKnowledgeStore.filter((entry) => {
    const text = String(entry.text || '').toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    return terms.some((term) => term.length > 2 && text.includes(term));
  });

  if (localHits.length) {
    return localHits[0].text.slice(0, 220);
  }

  return null;
}

function localKnowledgeSearch(query) {
  const q = normalizeMessage(query).toLowerCase();
  if (!q) return [];

  const scored = localKnowledgeStore
    .map((entry) => {
      const text = String(entry.text || '').toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const matches = terms.filter((term) => term.length > 2 && text.includes(term)).length;
      return { entry, score: matches };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ entry, score }) => ({
    id: entry.id,
    source: entry.source || entry.filename || 'local-memory',
    score,
    text: entry.text,
    metadata: entry.metadata || {}
  }));
}

async function callGrok(prompt) {
  const llmUrl = process.env.GROK_API_URL || process.env.LLM_API_URL || 'https://api.x.ai/v1/chat/completions';
  const llmKey = process.env.GROK_API_KEY || process.env.LLM_API_KEY;
  const model = process.env.GROK_MODEL || 'grok-4-latest';

  if (!llmKey) {
    throw new Error('Missing GROK_API_KEY or LLM_API_KEY');
  }

  const response = await fetch(llmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful, factual assistant. Answer with up-to-date knowledge when available. For site-specific facts, prioritize the provided site facts over generic knowledge. Keep responses concise and friendly.'
        },
        { role: 'user', content: prompt }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const text =
    json.choices?.[0]?.message?.content ||
    json.content?.[0]?.text ||
    json.output?.[0]?.content?.[0]?.text ||
    'No answer generated.';

  return String(text).trim();
}

async function streamGrokToClient(res, prompt, sources, fallbackWa) {
  try {
    const answer = await callGrok(prompt);
    const words = answer.match(/.{1,180}/g) || [answer];

    for (let i = 0; i < words.length; i++) {
      res.write(toSseData({ type: 'token', text: words[i] }));
    }

    res.write(toSseData({
      type: 'done',
      fallback: false,
      sources: sources.map((s) => ({
        id: s.id,
        source: s.source,
        score: s.score
      })),
      wa_link: `https://wa.me/${fallbackWa}`
    }));
  } catch (error) {
    console.error(error);
    const fallback = createFallbackPayload(fallbackWa);
    res.write(toSseData({ type: 'token', text: fallback.answer }));
    res.write(toSseData({ type: 'done', ...fallback }));
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/config', (_req, res) => {
  const owner = process.env.SITE_OWNER || 'Saigon Web Designer';
  const waOwner = process.env.WA_NUMBER_OWNER || '254759240255';
  const waCeo = process.env.WA_NUMBER_CEO || '254711922007';
  const email = process.env.CONTACT_EMAIL || 'infininesmartsolutions@gmail.com';

  res.json({
    owner,
    owner_name: owner,
    whatsapp_owner: `https://wa.me/${waOwner}`,
    whatsapp_ceo: `https://wa.me/${waCeo}`,
    email,
    wa_number_owner: waOwner,
    wa_number_ceo: waCeo
  });
});

app.get('/widget', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'chat-widget.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file upload.' });

    const sessionId = req.body.sessionId || 'default';
    const session = ensureSession(sessionId);

    const parsed = await parseUploadedFile(req.file);
    const chunks = [];

    for (const item of parsed) {
      const pageChunks = chunkText(item.text, 500, 120);
      for (const chunk of pageChunks) {
        chunks.push({
          id: uuidv4(),
          filename: item.meta.filename,
          page: item.meta.page || 1,
          source: `${item.meta.filename}#page${item.meta.page || 1}`,
          text: chunk.text,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          sessionId
        });
      }
    }

    if (!chunks.length) {
      return res.status(400).json({ error: 'No readable content found in uploaded file.' });
    }

    const vectorTexts = chunks.map((c) => c.text);
    const localDocs = chunks.map((chunk) => ({
      id: chunk.id,
      source: chunk.source,
      filename: chunk.filename,
      text: chunk.text,
      page: chunk.page,
      metadata: {
        source: chunk.source,
        filename: chunk.filename,
        page: chunk.page,
        chunkIndex: chunk.id,
        sessionId,
        text: chunk.text
      }
    }));
    localKnowledgeStore.push(...localDocs);

    let upsertRecords = [];
    let result = { mode: 'local-memory' };

    if (process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY && process.env.VECTOR_DB_URL) {
      const vectors = await embedTexts(vectorTexts);
      upsertRecords = chunks.map((chunk, idx) => ({
        id: chunk.id,
        values: vectors[idx],
        metadata: {
          source: chunk.source,
          filename: chunk.filename,
          page: chunk.page,
          chunkIndex: idx,
          sessionId,
          text: chunk.text
        }
      }));
      result = await upsertVectors(upsertRecords);
    }

    session.fileIds.push(req.file.filename);

    const sampleSnippet = chunks[0]?.text?.slice(0, 180) || '';

    res.json({
      ok: true,
      file: req.file.originalname,
      inserted: upsertRecords.length || localDocs.length,
      summary: `Indexed ${upsertRecords.length || localDocs.length} chunks from ${req.file.originalname}.`,
      sampleSnippet,
      vectorDbResult: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: 'Upload failed',
      details: error.message
    });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default', siteText = '' } = req.body || {};
    if (!message || !normalizeMessage(message)) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const query = [normalizeMessage(message), siteText].filter(Boolean).join('\n\n');
    const waOwner = process.env.WA_NUMBER_OWNER || '254759240255';
    const owner = process.env.SITE_OWNER || 'Saigon Web Designer';
    const email = process.env.CONTACT_EMAIL || 'infininesmartsolutions@gmail.com';

    let sources = [];
    try {
      const results = await searchSimilar(query, 5);
      sources = results.map((hit) => {
        const metadata = hit.metadata || {};
        return {
          id: hit.id,
          source: metadata.source || metadata.filename || 'site',
          score: Number(hit.score || 0),
          text: hit.text || metadata.text || ''
        };
      });
    } catch (error) {
      console.warn('Using local fallback search for chat request:', error.message);
      sources = localKnowledgeSearch(query);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const localAnswer = answerQuestionLocally(message);
    const prompt = buildRagPrompt({
      question: message,
      sources,
      ownerName: owner,
      email,
      waNumberOwner: waOwner
    });

    if (process.env.GROK_API_KEY || process.env.LLM_API_KEY) {
      try {
        const answer = await callGrok(prompt);
        const words = answer.match(/.{1,180}/g) || [answer];
        for (let i = 0; i < words.length; i++) {
          res.write(toSseData({ type: 'token', text: words[i] }));
        }
        res.write(toSseData({
          type: 'done',
          fallback: false,
          answer,
          sources: sources.map((s) => ({
            id: s.id,
            source: s.source,
            score: s.score
          })),
          wa_link: `https://wa.me/${waOwner}`
        }));
        res.end();
        return;
      } catch (error) {
        console.warn('Grok failed, falling back to local assistant logic:', error.message);
      }
    }

    if (!sources.length || sources.every((s) => Number(s.score || 0) < 0.18)) {
      if (localAnswer) {
        res.write(toSseData({ type: 'start', fallback: true }));
        res.write(toSseData({ type: 'token', text: localAnswer }));
        res.write(toSseData({ type: 'done', fallback: true, wa_link: `https://wa.me/${waOwner}`, answer: localAnswer, sources: [] }));
        res.end();
        return;
      }

      const fallback = createFallbackPayload(waOwner);
      res.write(toSseData({ type: 'start', fallback: true }));
      res.write(toSseData({ type: 'token', text: fallback.answer }));
      res.write(toSseData({ type: 'done', ...fallback }));
      res.end();
      return;
    }

    try {
      await streamGrokToClient(res, prompt, sources, waOwner);
    } catch (error) {
      console.error('streamGrokToClient failed, using local answer fallback', error);
      res.write(toSseData({ type: 'token', text: localAnswer || 'Here is the best local answer I can provide.' }));
      res.write(toSseData({ type: 'done', fallback: true, wa_link: `https://wa.me/${waOwner}`, answer: localAnswer || 'Here is the best local answer I can provide.', sources }));
    }
    res.end();
  } catch (error) {
    console.error(error);
    const fallback = createFallbackPayload(process.env.WA_NUMBER_OWNER || '254759240255');
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(toSseData({ type: 'start', fallback: true }));
    res.write(toSseData({ type: 'token', text: fallback.answer }));
    res.write(toSseData({ type: 'done', ...fallback }));
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
