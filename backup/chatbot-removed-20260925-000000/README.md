# Retrieval-Augmented Chat Assistant

A minimal RAG assistant for a site and uploaded documents. It indexes site content and uploaded PDFs, DOCX files, and images, stores vectors in Pinecone or Qdrant, retrieves top-k matches, and asks Grok to generate concise answers. Keys stay on the server only.

## Features
- Site + uploaded file indexing
- PDF / DOCX / image parsing
- chunking with overlap
- embeddings + vector search
- Grok generation on the server
- SSE streaming to browser
- file uploads + session tracking
- WhatsApp fallback flow

## Install
```bash
npm install
cp server/.env.example server/.env
```

## Environment variables
Set the values in `server/.env`:
```env
PORT=3000
VECTOR_DB=pinecone
VECTOR_DB_URL=https://your-index.svc.aped-xxxx.pinecone.io
VECTOR_DB_KEY=replace-me
LLM_API_URL=https://api.x.ai/v1/chat/completions
LLM_API_KEY=replace-me
EMBEDDING_API_URL=https://api.openai.com/v1/embeddings
EMBEDDING_API_KEY=replace-me
EMBEDDING_MODEL=text-embedding-3-small
WA_NUMBER_OWNER=254759240255
WA_NUMBER_CEO=254711922007
CONTACT_EMAIL=infininesmartsolutions@gmail.com
SITE_OWNER=Saigon Web Designer
```

## Run
```bash
npm run dev
```

Then visit:
- Health: http://localhost:3000/health
- Config: http://localhost:3000/config

## Pinecone vs Qdrant
- Pinecone:
  - `VECTOR_DB=pinecone`
  - set `VECTOR_DB_URL` and `VECTOR_DB_KEY`
- Qdrant:
  - `VECTOR_DB=qdrant`
  - set `VECTOR_DB_URL` to your Qdrant HTTP endpoint

## API
### Upload
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@./sample.txt" \
  -F "sessionId=test-session"
```

### Chat
```bash
curl -N -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Do you offer KRA help?","sessionId":"test-session"}'
```

### Health
```bash
curl http://localhost:3000/health
```

### Config
```bash
curl http://localhost:3000/config
```

## Notes
- Grok is used only server-side.
- No API keys are exposed to the browser.
- The fallback answer must be returned when good matches are not found:
  `"I couldn't find that in the uploaded files or the site — would you like to message us on WhatsApp? https://wa.me/[WA_NUMBER_OWNER]"`
- The client should render a WhatsApp CTA when `fallback: true` or the fallback text is detected.

## Example tests
1. “Who owns this site?” → returns `SITE_OWNER`
2. “How do I apply for HELB?” → returns retrieved snippet or fallback CTA
3. Upload `terms.pdf` containing “Infinine offers KRA services” and ask “Do you offer KRA help?” → bot cites `terms.pdf#page1`

## Checklist
- [ ] Set env values in `server/.env`
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Upload a sample file
- [ ] Ask a sample question and confirm the answer + source citations
