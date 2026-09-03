const PERIOD_LABELS = {
  en: { HOURLY: 'per hour', DAILY: 'per day', WEEKLY: 'per week', MONTHLY: 'per month', ANNUAL: 'per year' },
  hi: { HOURLY: 'प्रति घंटा', DAILY: 'प्रति दिन', WEEKLY: 'प्रति सप्ताह', MONTHLY: 'प्रति माह', ANNUAL: 'प्रति वर्ष' },
  de: { HOURLY: 'pro Stunde', DAILY: 'pro Tag', WEEKLY: 'pro Woche', MONTHLY: 'pro Monat', ANNUAL: 'pro Jahr' },
  fr: { HOURLY: 'par heure', DAILY: 'par jour', WEEKLY: 'par semaine', MONTHLY: 'par mois', ANNUAL: 'par an' },
  it: { HOURLY: "all’ora", DAILY: 'al giorno', WEEKLY: 'a settimana', MONTHLY: 'al mese', ANNUAL: "all’anno" },
  nl: { HOURLY: 'per uur', DAILY: 'per dag', WEEKLY: 'per week', MONTHLY: 'per maand', ANNUAL: 'per jaar' },
  es: { HOURLY: 'por hora', DAILY: 'por día', WEEKLY: 'por semana', MONTHLY: 'al mes', ANNUAL: 'al año' },
  ar: { HOURLY: 'في الساعة', DAILY: 'في اليوم', WEEKLY: 'في الأسبوع', MONTHLY: 'شهرياً', ANNUAL: 'سنوياً' }
};

export const LANGUAGE_DIRECTIONS = { ar: 'rtl' };

export function languageFromLocale(locale = 'en-GB') {
  return String(locale).split('-')[0].toLowerCase() || 'en';
}

export function directionFor(languageOrLocale = 'en') {
  const language = languageFromLocale(languageOrLocale);
  return LANGUAGE_DIRECTIONS[language] || 'ltr';
}

export function assertIanaTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }
}

export function formatNumber(value, locale = 'en-GB', options = {}) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat(locale, options).format(Number(value));
}

export function formatCurrency(value, currency, locale = 'en-GB', options = {}) {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, currencyDisplay: 'symbol', maximumFractionDigits: 0, ...options
  }).format(Number(value));
}

export function formatDate(value, { locale = 'en-GB', timezone = 'UTC', dateStyle = 'medium' } = {}) {
  if (!value) return '—';
  assertIanaTimezone(timezone);
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle }).format(new Date(value));
}

export function formatNumericDate(value, { locale = 'en-GB', timezone = 'UTC' } = {}) {
  if (!value) return '—';
  assertIanaTimezone(timezone);
  return new Intl.DateTimeFormat(locale, { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function formatTime(value, { locale = 'en-GB', timezone = 'UTC', hour12 } = {}) {
  if (!value) return '—';
  assertIanaTimezone(timezone);
  const options = { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  if (typeof hour12 === 'boolean') options.hour12 = hour12;
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatDateTime(value, { locale = 'en-GB', timezone = 'UTC', hour12 } = {}) {
  if (!value) return '—';
  assertIanaTimezone(timezone);
  const options = { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  if (typeof hour12 === 'boolean') options.hour12 = hour12;
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatEventForViewer(value, eventContext, viewerContext) {
  const eventTimezone = eventContext?.timezone || 'UTC';
  const viewerTimezone = viewerContext?.timezone || eventTimezone;
  const eventLocale = eventContext?.locale || viewerContext?.locale || 'en-GB';
  const viewerLocale = viewerContext?.locale || eventLocale;
  return {
    event: formatDateTime(value, { locale: eventLocale, timezone: eventTimezone }),
    viewer: formatDateTime(value, { locale: viewerLocale, timezone: viewerTimezone }),
    sameTimezone: eventTimezone === viewerTimezone,
    eventTimezone, viewerTimezone
  };
}

export function salaryPeriodLabel(period = 'ANNUAL', locale = 'en-GB') {
  const language = languageFromLocale(locale);
  return PERIOD_LABELS[language]?.[period] || PERIOD_LABELS.en[period] || period.toLowerCase();
}

export function formatSalary({ min, max, amount, currency, period = 'ANNUAL', locale = 'en-GB', grossNet = 'UNSPECIFIED' }) {
  const low = min ?? amount;
  const high = max;
  let rendered = formatCurrency(low, currency, locale);
  if (high !== null && high !== undefined && Number(high) !== Number(low)) rendered = `${rendered} – ${formatCurrency(high, currency, locale)}`;
  const grossNetLabel = grossNet && grossNet !== 'UNSPECIFIED' ? ` ${String(grossNet).toLowerCase()}` : '';
  return `${rendered} ${salaryPeriodLabel(period, locale)}${grossNetLabel}`;
}

export function localePreview(profile, amount = 120000) {
  if (!profile) return null;
  return {
    date: formatNumericDate('2026-09-03T12:30:00Z', { locale: profile.locale, timezone: profile.timezone }),
    time: formatTime('2026-09-03T12:30:00Z', { locale: profile.locale, timezone: profile.timezone }),
    salary: formatSalary({ min: amount, currency: profile.currency, period: 'ANNUAL', locale: profile.locale }),
    direction: directionFor(profile.language || profile.locale)
  };
}

export function sortCountries(countries = []) {
  return [...countries].sort((a, b) => String(a.country_name).localeCompare(String(b.country_name)));
}

export function timezonesForCountry(timezones = [], countryCode) {
  return timezones.filter((item) => item.country_code === countryCode).sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
}
