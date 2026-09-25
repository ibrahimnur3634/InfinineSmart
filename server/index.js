const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'chatbot-removed', message: 'Chatbot feature is disabled.' });
});

app.get('/config', (_req, res) => {
  res.json({
    chatbot_removed: true,
    contact: {
      whatsapp: 'https://wa.me/254711922007',
      email: 'infininesmartsolutions@gmail.com'
    }
  });
});

app.get('/widget', (_req, res) => {
  res.status(410).sendFile(path.join(__dirname, '..', 'bot.html'));
});

app.post('/chat', (_req, res) => {
  res.status(410).json({
    ok: false,
    message: 'Chatbot feature has been removed. Please use the WhatsApp contact link instead.'
  });
});

app.post('/upload', (_req, res) => {
  res.status(410).json({
    ok: false,
    message: 'Upload route removed with the chatbot feature.'
  });
});

app.listen(PORT, () => {
  console.log(`Chatbot routes disabled. Static site continues on http://localhost:${PORT}`);
});
