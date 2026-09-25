import { createHash } from 'node:crypto';

export const SUBMISSION_PACK_SCHEMA_VERSION = 'xz-submission-pack-v1';
export const SUBMISSION_PACK_PROMPT_VERSION = 'xz-submission-pack-2026-09-25-v1';

export const Provenance = Object.freeze({
  CLIENT_CONFIRMED: 'CLIENT_CONFIRMED',
  RESUME: 'RESUME',
  AI_DERIVED: 'AI_DERIVED',
  CANDIDATE_DECLARED: 'CANDIDATE_DECLARED',
  RECRUITER_VERIFIED: 'RECRUITER_VERIFIED',
  DOCUMENT_VERIFIED: 'DOCUMENT_VERIFIED',
  ACCOUNT_MANAGER_CONFIRMED: 'ACCOUNT_MANAGER_CONFIRMED',
  UNKNOWN: 'UNKNOWN',
});

export const AmDecision = Object.freeze({
  APPROVE: 'APPROVE',
  RETURN_TO_RECRUITER: 'RETURN_TO_RECRUITER',
  ON_HOLD: 'ON_HOLD',
  DECLINE_INTERNAL: 'DECLINE_INTERNAL',
});

export const ReturnReason = Object.freeze({
  MISSING_CANDIDATE_INFORMATION: 'MISSING_CANDIDATE_INFORMATION',
  SCREENING_INCOMPLETE: 'SCREENING_INCOMPLETE',
  CLIENT_REQUIREMENT_MISMATCH: 'CLIENT_REQUIREMENT_MISMATCH',
  COMPENSATION_ISSUE: 'COMPENSATION_ISSUE',
  AVAILABILITY_ISSUE: 'AVAILABILITY_ISSUE',
  RESUME_ISSUE: 'RESUME_ISSUE',
  SKILL_EVIDENCE_INSUFFICIENT: 'SKILL_EVIDENCE_INSUFFICIENT',
  WORK_AUTHORIZATION_CONCERN: 'WORK_AUTHORIZATION_CONCERN',
  PRESENTATION_QUALITY: 'PRESENTATION_QUALITY',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  OTHER: 'OTHER',
});

const VERIFIED = new Set([
  Provenance.CLIENT_CONFIRMED,
  Provenance.CANDIDATE_DECLARED,
  Provenance.RECRUITER_VERIFIED,
  Provenance.DOCUMENT_VERIFIED,
  Provenance.ACCOUNT_MANAGER_CONFIRMED,
]);

const ALL_PROVENANCE = new Set(Object.values(Provenance));

function text(value, max = 1200) {
  return String(value ?? '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function list(value) { return Array.isArray(value) ? value : []; }
function bool(value) {
  if (value === true || value === false) return value;
  const v = String(value ?? '').trim().toLowerCase();
  if (['true','yes','y','confirmed','interested','pass','qualified','complete','completed'].includes(v)) return true;
  if (['false','no','n','declined','not_interested','fail','not_qualified','incomplete'].includes(v)) return false;
  return null;
}
function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function uniq(values, max = 30) {
  const out = [];
  for (const raw of list(values)) {
    const v = text(typeof raw === 'string' ? raw : raw?.value ?? raw?.label ?? raw?.name ?? '', 600);
    if (v && !out.some(x => x.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}
function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

export function detectSubmissionPromptInjectionSignals(value) {
  const source = String(value ?? '');
  const patterns = [
    /ignore\s+(?:(?:all|any|the)\s+)?(?:(?:previous|prior)\s+)?(?:instructions?|rules?)/ig,
    /reveal\s+(?:the\s+)?(?:system|developer)\s+prompt/ig,
    /(?:approve|submit)\s+(?:me|candidate)\s+(?:automatically|now)/ig,
    /hide\s+(?:the\s+)?(?:gap|risk|salary|notice|authorization)/ig,
    /(?:change|set)\s+(?:my\s+)?(?:salary|notice|experience|score)\s+to/ig,
    /BEGIN\s+(?:SYSTEM|DEVELOPER)\s+PROMPT/ig,
  ];
  const hits = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const hit = text(match[0], 160);
      if (hit && !hits.some(x => x.toLowerCase() === hit.toLowerCase())) hits.push(hit);
      if (hits.length >= 20) return hits;
    }
  }
  return hits;
}

function safeNarrative(value, max = 900) {
  const v = text(value, max);
  return v && detectSubmissionPromptInjectionSignals(v).length === 0 ? v : '';
}

export function fact(value, provenance = Provenance.UNKNOWN, evidence = [], options = {}) {
  const p = ALL_PROVENANCE.has(provenance) ? provenance : Provenance.UNKNOWN;
  const normalized = value === undefined || value === null || value === '' ? null : value;
  return {
    value: normalized,
    provenance: normalized == null ? Provenance.UNKNOWN : p,
    verified: normalized == null ? false : VERIFIED.has(p),
    evidence: uniq(evidence, 8),
    visibility: options.visibility || 'CLIENT_ALLOWED',
    conflict: options.conflict || null,
  };
}

export function assertNoAiVerificationUpgrade(previous, next) {
  if (!previous || !next) return true;
  const before = previous.provenance;
  const after = next.provenance;
  if (before === Provenance.AI_DERIVED && VERIFIED.has(after) && !list(next.evidence).length) {
    const err = new Error('AI_DERIVED cannot become VERIFIED without human/document evidence');
    err.code = 'PROVENANCE_UPGRADE_REQUIRES_EVIDENCE';
    throw err;
  }
  return true;
}

function candidateValue(candidate, screening, key, screeningKey = key) {
  const verified = screening?.verifiedFacts?.[screeningKey];
  if (verified && verified.value !== undefined && verified.value !== null && verified.value !== '') {
    return fact(verified.value, verified.provenance || Provenance.RECRUITER_VERIFIED, verified.evidence || ['Human screening verification']);
  }
  const declared = screening?.candidateDeclared?.[screeningKey];
  if (declared !== undefined && declared !== null && declared !== '') {
    return fact(declared, Provenance.CANDIDATE_DECLARED, ['Candidate declaration captured during screening']);
  }
  const value = candidate?.[key];
  const profileProv = candidate?.provenance?.[key];
  if (value !== undefined && value !== null && value !== '') {
    return fact(value, ALL_PROVENANCE.has(profileProv) ? profileProv : Provenance.RESUME, candidate?.evidence?.[key] || []);
  }
  return fact(null, Provenance.UNKNOWN);
}

function approvedCriteria(input) {
  return list(input?.criteria).filter(c => ['MUST_HAVE','HARD_RULE'].includes(String(c?.criterion_kind || c?.kind || '').toUpperCase()));
}

function criterionResult(match, criterion) {
  const id = String(criterion?.id || '');
  const key = String(criterion?.field_key || criterion?.fieldKey || '');
  const label = String(criterion?.label || criterion?.value_text || criterion?.valueText || '');
  return list(match?.requirement_results || match?.requirementResults).find(r =>
    (id && String(r?.criterionId || r?.criterion_id || '') === id) ||
    (key && String(r?.fieldKey || r?.field_key || '') === key) ||
    (label && String(r?.label || r?.requirement || '') === label)
  );
}

export function submissionEligibility(input = {}) {
  const reasons = [];
  const warnings = [];
  const app = input.application || {};
  const screening = input.screening || {};
  const match = input.candidateIntelligence || input.match || {};
  const resume = input.resume || {};
  const config = input.configuration || {};

  const candidacy = String(app.candidacyState || app.candidacy_state || app.canonicalState || '').toUpperCase();
  if (candidacy !== 'QUALIFIED') reasons.push('CANDIDATE_NOT_QUALIFIED');

  const screeningState = String(screening.state || screening.screeningState || '').toUpperCase();
  if (screeningState !== 'QUALIFIED') reasons.push('SCREENING_NOT_QUALIFIED');
  if (bool(screening.completed ?? screening.completedAt ?? screening.completed_at) !== true && !screening.completedAt && !screening.completed_at) reasons.push('SCREENING_INCOMPLETE');
  if (bool(screening.interestConfirmed ?? screening.interest_confirmed ?? screening.interest) !== true) reasons.push('CANDIDATE_INTEREST_NOT_CONFIRMED');

  if (!match?.id || String(match?.run_status || match?.runStatus || '').toUpperCase() !== 'SUCCEEDED') reasons.push('CURRENT_CANDIDATE_INTELLIGENCE_REQUIRED');
  if (String(match?.hard_rule_status || match?.hardRuleStatus || 'UNKNOWN').toUpperCase() === 'FAIL') reasons.push('APPROVED_HARD_REQUIREMENT_FAILED');
  if (String(match?.hard_rule_status || match?.hardRuleStatus || 'UNKNOWN').toUpperCase() === 'UNKNOWN' && approvedCriteria(input).some(c => String(c?.enforcement || '').toUpperCase() === 'HARD' || c?.am_confirmed === true)) reasons.push('APPROVED_HARD_REQUIREMENT_UNRESOLVED');

  for (const c of approvedCriteria(input)) {
    if (String(c?.criterion_kind || c?.kind || '').toUpperCase() !== 'MUST_HAVE') continue;
    const r = criterionResult(match, c);
    const status = String(r?.status || 'UNKNOWN').toUpperCase();
    if (status === 'FAIL') reasons.push('MUST_HAVE_FAILED:' + text(c?.label || c?.field_key || c?.value_text, 100));
    if (status === 'UNKNOWN' && (c?.required_for_submission === true || c?.requiredForSubmission === true)) reasons.push('MUST_HAVE_UNRESOLVED:' + text(c?.label || c?.field_key || c?.value_text, 100));
  }

  if (!resume?.documentId && !resume?.document_id && !resume?.id) reasons.push('PRIMARY_RESUME_REQUIRED');
  if ((resume?.isLatest === false || resume?.is_latest === false) && config.requireLatestResume !== false) reasons.push('LATEST_RESUME_REQUIRED');

  const requiredFields = uniq(config.requiredFields || config.required_fields || [], 50);
  for (const field of requiredFields) {
    const value = input?.requiredData?.[field] ?? screening?.verifiedFacts?.[field]?.value ?? input?.candidate?.[field] ?? input?.commercial?.[field];
    if (value === undefined || value === null || value === '') reasons.push('MISSING_REQUIRED_FIELD:' + field);
  }

  const compliance = input.compliance || {};
  if (compliance.blocking === true || list(compliance.blockers).length) reasons.push('BLOCKING_COMPLIANCE_REQUIREMENT');
  if (bool(compliance.satisfied) === false && config.requireCompliance === true) reasons.push('BLOCKING_COMPLIANCE_REQUIREMENT');

  const conflicts = list(input.conflicts).filter(Boolean);
  if (conflicts.length) warnings.push('DATA_CONFLICT_REVIEW_REQUIRED');
  if (detectSubmissionPromptInjectionSignals(input.rawResumeText || '').length) warnings.push('UNTRUSTED_RESUME_INSTRUCTION_SIGNAL');
  if (detectSubmissionPromptInjectionSignals(screening.recruiterNote || '').length) warnings.push('UNTRUSTED_NOTE_INSTRUCTION_SIGNAL');

  return { eligible: reasons.length === 0, reasons: uniq(reasons, 100), warnings: uniq(warnings, 100) };
}

function displayFact(f, fallback = 'UNKNOWN') {
  if (!f || f.value === null || f.value === undefined || f.value === '') return fallback;
  return Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
}

function matchFact(item, defaultLabel) {
  if (!item) return null;
  const reason = safeNarrative(item.reason || item.explanation || item.summary || '', 700);
  if (!reason) return null;
  return {
    label: text(item.label || item.dimension || defaultLabel, 160),
    narrative: reason,
    provenance: Provenance.AI_DERIVED,
    verified: false,
    evidence: uniq(item.evidence || item.candidateEvidence || item.candidate_evidence || [], 8),
    status: text(item.status || '', 40) || null,
  };
}

function mustHaveRows(input) {
  const match = input.candidateIntelligence || input.match || {};
  const rows = [];
  for (const c of approvedCriteria(input).filter(x => String(x?.criterion_kind || x?.kind || '').toUpperCase() === 'MUST_HAVE')) {
    const result = criterionResult(match, c);
    rows.push({
      requirement: text(c?.label || c?.value_text || c?.valueText || c?.field_key || 'Must-have', 220),
      status: text(result?.status || 'UNKNOWN', 30).toUpperCase(),
      rationale: safeNarrative(result?.reason || '', 500) || null,
      provenance: Provenance.AI_DERIVED,
      evidence: uniq(result?.candidateEvidence || result?.candidate_evidence || result?.evidence || [], 8),
      requirementProvenance: Provenance.CLIENT_CONFIRMED,
    });
  }
  return rows;
}

export function buildSubmissionPack(input = {}, options = {}) {
  const eligibility = submissionEligibility(input);
  const candidate = input.candidate || {};
  const job = input.job || {};
  const requirement = input.requirement || {};
  const screening = input.screening || {};
  const match = input.candidateIntelligence || input.match || {};
  const resume = input.resume || {};
  const commercial = input.commercial || {};
  const now = options.now || new Date().toISOString();

  const name = candidateValue(candidate, screening, 'fullName', 'fullName');
  const currentTitle = candidateValue(candidate, screening, 'currentTitle', 'currentTitle');
  const currentCompany = candidateValue(candidate, screening, 'currentCompany', 'currentCompany');
  const totalExperience = candidateValue(candidate, screening, 'experienceYears', 'experienceYears');
  const relevantExperience = candidateValue(candidate, screening, 'relevantExperienceYears', 'relevantExperienceYears');
  const notice = candidateValue(candidate, screening, 'noticePeriodDays', 'noticePeriodDays');
  const availability = candidateValue(candidate, screening, 'availabilityStatus', 'availability');
  const location = candidateValue(candidate, screening, 'location', 'location');
  const workModel = candidateValue(candidate, screening, 'workplacePreference', 'workModel');
  const authorization = candidateValue(candidate, screening, 'workAuthorization', 'workAuthorization');
  const candidateInterest = fact(
    bool(screening.interestConfirmed ?? screening.interest_confirmed ?? screening.interest) === true ? 'CONFIRMED' : null,
    bool(screening.interestConfirmed ?? screening.interest_confirmed ?? screening.interest) === true ? Provenance.RECRUITER_VERIFIED : Provenance.UNKNOWN,
    screening.interestEvidence || (screening.completedAt ? ['Human screening completed'] : [])
  );

  const pay = commercial.candidatePayRate ?? commercial.candidate_pay_rate ?? commercial.compensation ?? candidate.salaryExpected ?? candidate.salary_expected;
  const payCurrency = commercial.candidatePayCurrency ?? commercial.candidate_pay_currency ?? commercial.currency ?? candidate.salaryCurrency ?? candidate.salary_currency;
  const payProv = commercial.candidatePayProvenance || Provenance.RECRUITER_VERIFIED;
  const compensation = pay == null ? fact(null) : fact({ amount: numberOrNull(pay), currency: text(payCurrency, 8) || null }, payProv, commercial.candidatePayEvidence || []);

  const skills = uniq(screening.verifiedSkills || candidate.skills || [], 24).map(skill => fact(skill, screening.verifiedSkills ? Provenance.RECRUITER_VERIFIED : Provenance.RESUME, ['Candidate skill evidence']));
  const strengths = list(match.strengths).slice(0, 5).map(x => matchFact(x, 'Strength')).filter(Boolean);
  const gaps = list(match.gaps).slice(0, 5).map(x => matchFact(x, 'Gap')).filter(Boolean);
  const uncertainties = list(match.uncertainties).slice(0, 5).map(x => matchFact(x, 'Uncertainty')).filter(Boolean);

  const experiencePieces = [];
  if (relevantExperience.value != null) experiencePieces.push(displayFact(relevantExperience) + ' relevant years');
  else if (totalExperience.value != null) experiencePieces.push(displayFact(totalExperience) + ' total years');
  if (currentTitle.value) experiencePieces.push(displayFact(currentTitle));
  if (currentCompany.value) experiencePieces.push('at ' + displayFact(currentCompany));

  const safeSummary = [displayFact(name, 'Candidate'), experiencePieces.length ? '— ' + experiencePieces.join(' ') : '']
    .filter(Boolean).join(' ').slice(0, 500);

  const recruiterSummary = safeNarrative(screening.summary || screening.recruiterSummary || '', 900);
  const recruiterContext = safeNarrative(options.recruiterContext || input.recruiterContext || '', 600);

  const conflicts = list(input.conflicts).map(c => ({
    field: text(c?.field || 'unknown', 80),
    values: list(c?.values).slice(0, 4).map(v => ({ value: text(v?.value ?? v, 300), provenance: ALL_PROVENANCE.has(v?.provenance) ? v.provenance : Provenance.UNKNOWN })),
    resolution: c?.resolution ? text(c.resolution, 300) : null,
  }));

  const pack = {
    schemaVersion: SUBMISSION_PACK_SCHEMA_VERSION,
    promptVersion: SUBMISSION_PACK_PROMPT_VERSION,
    generatedAt: now,
    sourceFingerprint: submissionSourceFingerprint(input),
    eligibility,
    candidateSummary: { narrative: safeSummary, facts: { name, currentTitle, currentCompany, totalExperience, relevantExperience } },
    whyCandidateFits: strengths.slice(0, 3),
    relevantExperience: { currentTitle, currentCompany, totalExperience, relevantExperience },
    mustHaveMatch: mustHaveRows(input),
    keySkills: skills,
    roleDomainRelevance: list(match.requirement_results || match.requirementResults).filter(x => /title|domain|industry|role/i.test(String(x?.dimension || x?.fieldKey || x?.field_key || x?.label || ''))).slice(0, 4).map(x => matchFact(x, 'Role/domain fit')).filter(Boolean),
    candidateInterest,
    availability: { availability, noticePeriodDays: notice },
    locationWorkModel: { location, workModel },
    compensation,
    workAuthorization: authorization,
    confirmedStrengths: strengths,
    knownGaps: gaps,
    openRisksUncertainties: uncertainties,
    recruiterScreeningSummary: recruiterSummary ? fact(recruiterSummary, Provenance.RECRUITER_VERIFIED, ['Human recruiter screening summary']) : fact(null),
    recruiterContext: recruiterContext ? fact(recruiterContext, Provenance.RECRUITER_VERIFIED, ['Recruiter context'], { visibility: 'INTERNAL_ONLY' }) : fact(null),
    resumeVersion: fact({
      documentId: resume.documentId || resume.document_id || resume.id || null,
      version: resume.versionNumber || resume.version_number || null,
      filename: text(resume.filename || '', 240) || null,
      checksum: text(resume.checksum || '', 160) || null,
    }, resume.documentId || resume.document_id || resume.id ? Provenance.DOCUMENT_VERIFIED : Provenance.UNKNOWN, resume.documentId || resume.document_id || resume.id ? ['Versioned primary resume'] : []),
    recruiter: fact({ id: screening.recruiterId || screening.recruiter_id || input.recruiter?.id || null, name: text(input.recruiter?.name || screening.recruiterName || '', 160) || null }, Provenance.RECRUITER_VERIFIED, ['Authenticated recruiter actor']),
    requirement: fact({ id: job.id || requirement.jobId || null, title: text(job.title || requirement.title || '', 220), briefId: requirement.id || requirement.briefId || null, version: requirement.versionNumber || requirement.version_number || null }, Provenance.CLIENT_CONFIRMED, ['Approved requirement / Hiring Brief']),
    commercialInternal: {
      clientBillRate: fact(commercial.clientBillRate ?? commercial.client_bill_rate ?? null, commercial.clientBillRate != null || commercial.client_bill_rate != null ? Provenance.ACCOUNT_MANAGER_CONFIRMED : Provenance.UNKNOWN, commercial.clientBillEvidence || [], { visibility: 'AM_ONLY' }),
      candidatePayRate: compensation,
      margin: fact(commercial.margin ?? null, commercial.margin != null ? Provenance.ACCOUNT_MANAGER_CONFIRMED : Provenance.UNKNOWN, commercial.marginEvidence || [], { visibility: 'AM_ONLY' }),
      markup: fact(commercial.markup ?? null, commercial.markup != null ? Provenance.ACCOUNT_MANAGER_CONFIRMED : Provenance.UNKNOWN, commercial.markupEvidence || [], { visibility: 'AM_ONLY' }),
    },
    conflicts,
  };

  return pack;
}

export function buildClientFacingSubmission(pack = {}, options = {}) {
  const includeCompensation = options.includeCompensation === true;
  const clientComp = includeCompensation && pack.compensation?.value != null ? pack.compensation : undefined;
  const sanitizeFact = value => {
    if (!value || value.visibility === 'INTERNAL_ONLY' || value.visibility === 'AM_ONLY') return undefined;
    return value;
  };
  return {
    schemaVersion: pack.schemaVersion,
    submissionVersion: options.submissionVersion || null,
    generatedAt: pack.generatedAt,
    candidateSummary: pack.candidateSummary,
    whyCandidateFits: list(pack.whyCandidateFits).filter(x => list(x.evidence).length > 0),
    relevantExperience: pack.relevantExperience,
    mustHaveMatch: pack.mustHaveMatch,
    keySkills: pack.keySkills,
    roleDomainRelevance: list(pack.roleDomainRelevance).filter(x => list(x.evidence).length > 0),
    candidateInterest: sanitizeFact(pack.candidateInterest),
    availability: pack.availability,
    locationWorkModel: pack.locationWorkModel,
    compensation: clientComp,
    workAuthorization: sanitizeFact(pack.workAuthorization),
    confirmedStrengths: list(pack.confirmedStrengths).filter(x => list(x.evidence).length > 0),
    knownGaps: pack.knownGaps,
    openRisksUncertainties: pack.openRisksUncertainties,
    recruiterScreeningSummary: sanitizeFact(pack.recruiterScreeningSummary),
    resumeVersion: sanitizeFact(pack.resumeVersion),
    requirement: sanitizeFact(pack.requirement),
  };
}

export function submissionSourceFingerprint(input = {}) {
  const match = input.candidateIntelligence || input.match || {};
  const requirement = input.requirement || {};
  const screening = input.screening || {};
  const resume = input.resume || {};
  const commercial = input.commercial || {};
  return hash({
    applicationId: input.application?.id || null,
    candidateId: input.candidate?.id || null,
    candidateUpdatedAt: input.candidate?.updatedAt || input.candidate?.updated_at || null,
    matchId: match.id || null,
    matchGeneratedAt: match.generated_at || match.generatedAt || null,
    briefId: requirement.id || requirement.briefId || null,
    briefVersion: requirement.versionNumber || requirement.version_number || null,
    screeningVersion: screening.version || screening.versionNumber || screening.version_number || screening.updatedAt || screening.updated_at || null,
    screeningState: screening.state || screening.screeningState || null,
    interest: screening.interestConfirmed ?? screening.interest_confirmed ?? screening.interest ?? null,
    resumeDocumentId: resume.documentId || resume.document_id || resume.id || null,
    resumeVersion: resume.versionNumber || resume.version_number || null,
    resumeChecksum: resume.checksum || null,
    commercialVersion: commercial.version || commercial.updatedAt || commercial.updated_at || hash(commercial),
  });
}

export function validateAmDecision({ action, reasonCode, note } = {}) {
  const a = String(action || '').toUpperCase();
  if (!Object.values(AmDecision).includes(a)) return { ok: false, error: 'INVALID_AM_DECISION' };
  if ([AmDecision.RETURN_TO_RECRUITER, AmDecision.DECLINE_INTERNAL].includes(a)) {
    if (!Object.values(ReturnReason).includes(String(reasonCode || '').toUpperCase())) return { ok: false, error: 'STRUCTURED_REASON_REQUIRED' };
  }
  if (a === AmDecision.ON_HOLD && !text(note, 1000)) return { ok: false, error: 'HOLD_NOTE_REQUIRED' };
  return { ok: true };
}

export function clientContentLeaksInternalData(clientPack = {}) {
  const raw = stableStringify(clientPack).toLowerCase();
  return ['commercialinternal','clientbillrate','margin','markup','internal_only','am_only','override reason','ai confidence','private note'].some(term => raw.includes(term));
}
