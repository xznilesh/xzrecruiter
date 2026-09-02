export function parseCsv(text, { maxRows = 1000 } = {}) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; if (rows.length > maxRows + 1) break; }
    else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const cleaned = rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (!cleaned.length) return { headers: [], rows: [], truncated: false };
  const headers = cleaned[0].map((value, index) => String(value || '').trim() || `Column ${index + 1}`);
  const dataRows = cleaned.slice(1, maxRows + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])));
  return { headers, rows: dataRows, truncated: cleaned.length - 1 > maxRows };
}

const targets = {
  COMPANY: ['name','domain','website','country_code','region','city'],
  CLIENT: ['name','website','industry','country_code','locale','timezone','currency_code'],
  CONTACT: ['full_name','client_name','title','email','phone'],
  CANDIDATE: ['full_name','email','phone','location','current_title','current_company','experience_years','salary_current','salary_expected','salary_currency','notice_period_days','country_code','locale','timezone']
};

const aliases = {
  name: ['name','company','company name','client','client name'], full_name: ['full name','name','candidate name','contact name'],
  client_name: ['client','client name','company'], email: ['email','email address','work email'], phone: ['phone','mobile','telephone'],
  domain: ['domain','company domain'], website: ['website','url','site'], country_code: ['country code','country','market'],
  region: ['region','state','province'], city: ['city','location city'], industry: ['industry','sector'], title: ['title','job title'],
  current_title: ['current title','job title','role'], current_company: ['current company','employer'], location: ['location','city'],
  experience_years: ['experience','experience years','years experience'], salary_current: ['current salary','salary current'],
  salary_expected: ['expected salary','salary expected'], salary_currency: ['salary currency','currency'], notice_period_days: ['notice period','notice days'],
  locale: ['locale','language locale'], timezone: ['timezone','time zone'], currency_code: ['currency','currency code']
};

export function targetFields(entityType) { return targets[String(entityType || '').toUpperCase()] || []; }

export function suggestMapping(headers, entityType) {
  const normalized = headers.map((h) => [h, String(h).trim().toLowerCase().replace(/[_-]+/g, ' ')]);
  return Object.fromEntries(targetFields(entityType).map((target) => {
    const names = aliases[target] || [target.replace(/_/g, ' ')];
    const match = normalized.find(([, value]) => names.includes(value));
    return [target, match?.[0] || ''];
  }));
}

export function mapCsvRows(rows, mapping) {
  return rows.map((raw) => {
    const mapped = {};
    for (const [target, source] of Object.entries(mapping || {})) if (source) mapped[target] = raw[source] ?? '';
    return { raw, mapped };
  });
}
