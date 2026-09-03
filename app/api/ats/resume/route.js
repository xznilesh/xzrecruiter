import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { atsAction } from '@/lib/ats';
import { extractResumeText, parseResumeText } from '@/lib/resume-parser';
import { storageConfigured, uploadPrivateObject } from '@/lib/server-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const MAX_BYTES = 8 * 1024 * 1024;

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  if (!storageConfigured()) return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });

  let form;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'invalid_multipart' }, { status: 400 }); }

  const candidateId = String(form.get('candidateId') || '');
  const file = form.get('file');
  if (!uuid(candidateId)) return NextResponse.json({ error: 'candidate_required' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'unsupported_file_type' }, { status: 415 });
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: 'invalid_file_size' }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');

  let prepared;
  try {
    prepared = await atsAction('prepareResumeUpload', {
      candidateId,
      filename: file.name || 'resume',
      mimeType: file.type,
      sizeBytes: file.size,
      checksum
    });
  } catch (error) {
    console.error('resume_prepare_failed', error?.message || '');
    return NextResponse.json({ error: 'resume_prepare_failed' }, { status: 503 });
  }
  if (!prepared?.ok) return NextResponse.json(prepared || { error: 'resume_prepare_failed' }, { status: prepared?.error === 'forbidden' ? 403 : 400 });

  try {
    await uploadPrivateObject(prepared.storage_path, bytes, file.type);
  } catch (error) {
    console.error('resume_storage_failed', error?.message || '', error?.details || '');
    await atsAction('finalizeResumeParse', {
      parseRunId: prepared.parse_run_id,
      extractedData: {},
      fieldConfidence: {},
      fieldEvidence: {},
      error: 'storage_upload_failed'
    }).catch(() => null);
    return NextResponse.json({ error: 'storage_upload_failed' }, { status: 503 });
  }

  try {
    const text = await extractResumeText(bytes, file.type, file.name);
    if (!text || text.length < 20) throw new Error('resume_text_empty');
    const parsed = parseResumeText(text);
    const finalized = await atsAction('finalizeResumeParse', {
      parseRunId: prepared.parse_run_id,
      extractedData: parsed.extractedData,
      fieldConfidence: parsed.fieldConfidence,
      fieldEvidence: parsed.fieldEvidence,
      error: null
    });
    if (!finalized?.ok) return NextResponse.json(finalized, { status: 400 });
    return NextResponse.json({
      ok: true,
      documentId: prepared.document_id,
      parseRunId: prepared.parse_run_id,
      versionNumber: prepared.version_number,
      extractedData: parsed.extractedData,
      fieldConfidence: parsed.fieldConfidence,
      fieldEvidence: parsed.fieldEvidence,
      textLength: parsed.textLength
    });
  } catch (error) {
    console.error('resume_parse_failed', error?.message || '');
    await atsAction('finalizeResumeParse', {
      parseRunId: prepared.parse_run_id,
      extractedData: {},
      fieldConfidence: {},
      fieldEvidence: {},
      error: error?.message || 'parse_failed'
    }).catch(() => null);
    return NextResponse.json({ error: 'resume_parse_failed' }, { status: 422 });
  }
}
