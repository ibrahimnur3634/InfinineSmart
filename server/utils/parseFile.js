const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

async function extractPdfText(buffer, filename) {
  const parsed = await pdf(buffer);
  const pages = (parsed.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return pages.map((text, idx) => ({
    text,
    meta: {
      filename,
      page: idx + 1,
      startChar: 0,
      endChar: text.length
    }
  }));
}

async function extractDocxText(buffer, filename) {
  const result = await mammoth.extractRawText({ buffer });
  const text = String(result.value || '').trim();

  return [{
    text,
    meta: {
      filename,
      page: 1,
      startChar: 0,
      endChar: text.length
    }
  }];
}

async function extractImageText(buffer, filename) {
  const result = await Tesseract.recognize(buffer, 'eng');
  const text = String(result.data?.text || '').trim();

  return [{
    text,
    meta: {
      filename,
      page: 1,
      startChar: 0,
      endChar: text.length
    }
  }];
}

async function parseUploadedFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const buffer = file.buffer || fs.readFileSync(file.path);

  try {
    if (ext === '.pdf') return await extractPdfText(buffer, file.originalname);
    if (ext === '.docx' || ext === '.doc') return await extractDocxText(buffer, file.originalname);
    if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) {
      return await extractImageText(buffer, file.originalname);
    }
    if (ext === '.txt' || ext === '.md') {
      const text = buffer.toString('utf8');
      return [{
        text,
        meta: {
          filename: file.originalname,
          page: 1,
          startChar: 0,
          endChar: text.length
        }
      }];
    }

    return [{
      text: buffer.toString('utf8') || 'No readable text found.',
      meta: {
        filename: file.originalname || 'unknown',
        page: 1,
        startChar: 0,
        endChar: buffer.length
      }
    }];
  } catch (error) {
    console.error('parseUploadedFile error', error);
    return [{
      text: `Unable to parse file: ${file.originalname}`,
      meta: {
        filename: file.originalname || 'unknown',
        page: 1,
        startChar: 0,
        endChar: 0
      }
    }];
  }
}

module.exports = { parseUploadedFile };
