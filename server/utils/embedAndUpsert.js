const fetch = require('node-fetch');

async function embedTexts(texts) {
  const embeddingUrl = process.env.EMBEDDING_API_URL;
  const embeddingKey = process.env.EMBEDDING_API_KEY;

  if (!embeddingUrl || !embeddingKey) {
    throw new Error('Missing EMBEDDING_API_URL or EMBEDDING_API_KEY');
  }

  const response = await fetch(embeddingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${embeddingKey}`
    },
    body: JSON.stringify({
      input: texts,
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  return (json.data || []).map((item) => item.embedding || []);
}

async function upsertVectors(records) {
  const db = (process.env.VECTOR_DB || 'pinecone').toLowerCase();
  const url = process.env.VECTOR_DB_URL;
  const key = process.env.VECTOR_DB_KEY;

  if (!url) throw new Error('Missing VECTOR_DB_URL');

  if (db === 'pinecone') {
    const response = await fetch(`${url}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': key || ''
      },
      body: JSON.stringify({
        vectors: records,
        namespace: 'site-docs'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pinecone upsert failed: ${response.status} ${text}`);
    }

    return await response.json();
  }

  if (db === 'qdrant') {
    const response = await fetch(`${url}/collections/site-docs/points?wait=true`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        points: records.map((item) => ({
          id: item.id,
          vector: item.values,
          payload: item.metadata
        }))
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant upsert failed: ${response.status} ${text}`);
    }

    return await response.json();
  }

  throw new Error(`Unsupported VECTOR_DB: ${process.env.VECTOR_DB || 'pinecone'}`);
}

async function searchSimilar(query, topK = 5) {
  const db = (process.env.VECTOR_DB || 'pinecone').toLowerCase();
  const url = process.env.VECTOR_DB_URL;
  const key = process.env.VECTOR_DB_KEY;

  const [queryVector] = await embedTexts([query]);

  if (db === 'pinecone') {
    const response = await fetch(`${url}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': key || ''
      },
      body: JSON.stringify({
        vector: queryVector,
        topK,
        includeMetadata: true,
        namespace: 'site-docs'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pinecone search failed: ${response.status} ${text}`);
    }

    const json = await response.json();
    return (json.matches || []).map((item) => ({
      id: item.id,
      score: item.score,
      metadata: item.metadata || {},
      text: item.metadata?.text || ''
    }));
  }

  if (db === 'qdrant') {
    const response = await fetch(`${url}/collections/site-docs/points/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vector: queryVector,
        limit: topK,
        with_payload: true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant search failed: ${response.status} ${text}`);
    }

    const json = await response.json();
    return (json.result || []).map((item) => ({
      id: item.id,
      score: item.score,
      metadata: item.payload || {},
      text: item.payload?.text || ''
    }));
  }

  throw new Error(`Unsupported VECTOR_DB: ${process.env.VECTOR_DB || 'pinecone'}`);
}

module.exports = { embedTexts, upsertVectors, searchSimilar };
