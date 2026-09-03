'use client';

import { useState } from 'react';

export function Field({ label, hint, error, required, children, htmlFor }) {
  return <div className={`form-control ${error ? 'has-error' : ''}`}>
    <label htmlFor={htmlFor}>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}</label>
    {children}
    {hint && !error ? <small className="field-hint">{hint}</small> : null}
    {error ? <small className="field-error" role="alert">{error}</small> : null}
  </div>;
}

export function TextInput({ label, name, hint, error, required, ...props }) {
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={name}><input id={name} name={name} required={required} aria-invalid={!!error} {...props} /></Field>;
}

export function EmailInput(props) { return <TextInput type="email" autoComplete="email" {...props} />; }
export function DateInput(props) { return <TextInput type="date" {...props} />; }
export function DateTimeInput(props) { return <TextInput type="datetime-local" {...props} />; }

export function SelectInput({ label, name, options = [], hint, error, required, placeholder = 'Select…', ...props }) {
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={name}><select id={name} name={name} required={required} aria-invalid={!!error} {...props}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
}

export function CountrySelect({ countries = [], ...props }) {
  return <SelectInput {...props} options={countries.map((c) => ({ value: c.country_code, label: c.country_name }))} />;
}

export function TimezoneSelect({ timezones = [], ...props }) {
  return <SelectInput {...props} options={timezones.map((z) => ({ value: z.timezone_id, label: `${z.display_name} · ${z.timezone_id}${z.observes_dst ? ' · DST' : ''}` }))} />;
}

export function PhoneInput({ label = 'Phone', name = 'phone', callingCode = '', error, hint, ...props }) {
  return <Field label={label} hint={hint} error={error} htmlFor={name}><div className="compound-input"><span className="input-prefix">{callingCode || '+'}</span><input id={name} name={name} type="tel" autoComplete="tel" aria-invalid={!!error} {...props} /></div></Field>;
}

export function CurrencyInput({ label, name, currency = 'USD', error, hint, ...props }) {
  return <Field label={label} hint={hint} error={error} htmlFor={name}><div className="compound-input"><span className="input-prefix">{currency}</span><input id={name} name={name} type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={!!error} {...props} /></div></Field>;
}

export function SalaryRangeInput({ currency = 'USD', period = 'ANNUAL', minName = 'salaryMin', maxName = 'salaryMax', values = {}, onChange }) {
  return <div className="form-control"><label>Salary range</label><div className="salary-range-control"><div className="compound-input"><span className="input-prefix">{currency}</span><input name={minName} type="number" min="0" step="1" placeholder="Minimum" value={values.min ?? ''} onChange={(e) => onChange?.({ ...values, min: e.target.value })} /></div><span aria-hidden="true">–</span><div className="compound-input"><span className="input-prefix">{currency}</span><input name={maxName} type="number" min="0" step="1" placeholder="Maximum" value={values.max ?? ''} onChange={(e) => onChange?.({ ...values, max: e.target.value })} /></div><span className="salary-period-chip">{period.toLowerCase()}</span></div></div>;
}

export function MultiSelect({ label, name, options = [], value = [], onChange, hint }) {
  function toggle(item) { onChange?.(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]); }
  return <fieldset className="form-control multi-select"><legend>{label}</legend><div className="multi-select-options">{options.map((option) => <label key={option.value} className={value.includes(option.value) ? 'selected' : ''}><input type="checkbox" name={name} value={option.value} checked={value.includes(option.value)} onChange={() => toggle(option.value)} /><span>{option.label}</span></label>)}</div>{hint && <small className="field-hint">{hint}</small>}</fieldset>;
}

export function TagsInput({ label, name, value = [], onChange, placeholder = 'Type and press Enter' }) {
  const [draft, setDraft] = useState('');
  function add() { const next = draft.trim(); if (next && !value.includes(next)) onChange?.([...value, next]); setDraft(''); }
  return <div className="form-control"><label htmlFor={`${name}-input`}>{label}</label><div className="tags-control">{value.map((tag) => <button type="button" key={tag} onClick={() => onChange?.(value.filter((v) => v !== tag))} aria-label={`Remove ${tag}`}>{tag} ×</button>)}<input id={`${name}-input`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} placeholder={placeholder} /></div></div>;
}

export function EntitySelector({ label, name, entities = [], value = '', onChange, entityType = 'record', placeholder }) {
  const [query, setQuery] = useState('');
  const shown = query ? entities.filter((e) => String(e.label).toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  return <div className="form-control entity-selector"><label htmlFor={`${name}-search`}>{label}</label><input id={`${name}-search`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder || `Search ${entityType}`} autoComplete="off" />{shown.length > 0 && <div className="entity-results" role="listbox">{shown.map((entity) => <button type="button" key={entity.value} onClick={() => { onChange?.(entity.value); setQuery(entity.label); }} className={value === entity.value ? 'selected' : ''}>{entity.label}</button>)}</div>}<input type="hidden" name={name} value={value} /></div>;
}

export const CompanySelector = (props) => <EntitySelector entityType="companies" {...props} />;
export const CandidateSelector = (props) => <EntitySelector entityType="candidates" {...props} />;
export const JobSelector = (props) => <EntitySelector entityType="jobs" {...props} />;
export const UserSelector = (props) => <EntitySelector entityType="users" {...props} />;
