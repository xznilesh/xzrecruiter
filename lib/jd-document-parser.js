import { extractResumeText } from '@/lib/resume-parser';

export const JD_ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export const JD_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const JD_MAX_TEXT_CHARS = 120000;

export async function extractJdDocumentText(buffer,mimeType,filename=''){
  const text=await extractResumeText(buffer,mimeType,filename);
  return String(text||'').trim().slice(0,JD_MAX_TEXT_CHARS);
}
