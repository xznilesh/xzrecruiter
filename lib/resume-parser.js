const MAX_TEXT = 120000;
const SKILL_DICTIONARY = [
  'JavaScript','TypeScript','React','Next.js','Node.js','NestJS','Java','Spring Boot','Python','Django','FastAPI','C#','.NET','C++','Go','Rust','PHP','Laravel','Ruby','Rails',
  'SQL','PostgreSQL','MySQL','MongoDB','Redis','Kafka','RabbitMQ','GraphQL','REST','gRPC','Docker','Kubernetes','AWS','Azure','GCP','Terraform','GitHub Actions','CI/CD',
  'Salesforce','SAP','Oracle','Workday','ServiceNow','Power BI','Tableau','Excel','Tally','Zoho','Recruitment','Sourcing','Boolean Search','Account Management','Business Development',
  'Machine Learning','Deep Learning','NLP','LLM','Data Science','Data Engineering','Cybersecurity','DevOps','SRE','QA','Selenium','Cypress','Playwright','Figma','Product Management'
];

function clean(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT);
}

export async function extractResumeText(buffer, mimeType, filename = '') {
  const name = String(filename || '').toLowerCase();
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    const mod = await import('pdf-parse');
    const parsePdf = mod.default || mod;
    const result = await parsePdf(buffer);
    return clean(result?.text || '');
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
    const mod = await import('mammoth');
    const mammoth = mod.default || mod;
    const result = await mammoth.extractRawText({ buffer });
    return clean(result?.value || '');
  }
  if (mimeType === 'text/plain' || name.endsWith('.txt')) return clean(buffer.toString('utf8'));
  throw new Error('unsupported_file_type');
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() || match?.[0]?.trim() || '';
}

function evidenceLine(lines, value) {
  if (!value) return '';
  const low = String(value).toLowerCase();
  return lines.find((line) => line.toLowerCase().includes(low)) || '';
}

function likelyName(lines) {
  for (const line of lines.slice(0, 10)) {
    const value = line.trim();
    if (value.length < 3 || value.length > 70) continue;
    if (/@|https?:|linkedin|resume|curriculum|vitae|phone|mobile|email/i.test(value)) continue;
    if (/\d{4,}/.test(value)) continue;
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5 && words.every((w) => /^[A-Za-zÀ-ÿ.'’-]+$/.test(w))) return value;
  }
  return '';
}

function likelyHeadline(lines, name) {
  const start = Math.max(0, lines.findIndex((x) => x === name));
  for (const line of lines.slice(start + 1, start + 7)) {
    const value = line.trim();
    if (value.length < 3 || value.length > 100) continue;
    if (/@|https?:|linkedin|phone|mobile|email|\+?\d[\d\s().-]{6,}/i.test(value)) continue;
    return value;
  }
  return '';
}

function extractEducation(lines) {
  const tokens = /\b(bachelor|master|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|bsc|msc|bca|mca|mba|ph\.?d|doctorate|diploma|university|college|institute)\b/i;
  return lines.filter((line) => tokens.test(line)).slice(0, 12).map((line) => ({ text: line.trim() }));
}

function extractExperienceYears(text) {
  const values = [];
  for (const match of text.matchAll(/\b(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\b/gi)) {
    const n = Number(match[1]);
    if (n >= 0 && n <= 50) values.push(n);
  }
  return values.length ? Math.max(...values) : null;
}

function extractSkills(text) {
  const low = text.toLowerCase();
  return SKILL_DICTIONARY.filter((skill) => low.includes(skill.toLowerCase())).slice(0, 50);
}

export function parseResumeText(rawText) {
  const text = clean(rawText);
  const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
  const email = firstMatch(text, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i).toLowerCase();
  const phone = firstMatch(text, /(?:^|\D)(\+?\d[\d\s().-]{7,}\d)(?:\D|$)/m).replace(/[^\d+]/g, '');
  const fullName = likelyName(lines);
  const headline = likelyHeadline(lines, fullName);
  const experienceYears = extractExperienceYears(text);
  const skills = extractSkills(text);
  const education = extractEducation(lines);

  const extractedData = {
    fullName: fullName || undefined,
    email: email || undefined,
    phone: phone || undefined,
    headline: headline || undefined,
    currentTitle: headline || undefined,
    experienceYears: experienceYears ?? undefined,
    skills,
    education,
    textPreview: text.slice(0, 4000)
  };
  Object.keys(extractedData).forEach((key) => extractedData[key] === undefined && delete extractedData[key]);

  const fieldConfidence = {
    fullName: fullName ? 0.72 : 0,
    email: email ? 0.99 : 0,
    phone: phone ? 0.9 : 0,
    headline: headline ? 0.58 : 0,
    currentTitle: headline ? 0.52 : 0,
    experienceYears: experienceYears != null ? 0.66 : 0,
    skills: skills.length ? Math.min(0.92, 0.52 + skills.length * 0.02) : 0,
    education: education.length ? 0.7 : 0
  };

  const fieldEvidence = {
    fullName: evidenceLine(lines, fullName),
    email: evidenceLine(lines, email),
    phone: evidenceLine(lines, phone),
    headline: evidenceLine(lines, headline),
    currentTitle: evidenceLine(lines, headline),
    experienceYears: experienceYears != null ? evidenceLine(lines, `${experienceYears}`) : '',
    skills: skills.slice(0, 12),
    education: education.slice(0, 6)
  };

  return { extractedData, fieldConfidence, fieldEvidence, textLength: text.length };
}
