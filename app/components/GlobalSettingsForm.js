'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountrySelect, SelectInput, TextInput, TimezoneSelect } from '@/app/components/FormControls';
import { directionFor, formatDateTime, formatSalary, timezonesForCountry } from '@/lib/globalization';
import { namespace } from '@/i18n/resources';

export default function GlobalSettingsForm({ context, canEdit = false }) {
  const router = useRouter();
  const initial = context.settings || {};
  const [form, setForm] = useState({
    countryCode: initial.country_code || 'GB', locale: initial.locale || 'en-GB', currencyCode: initial.currency_code || 'GBP',
    timezoneId: initial.timezone_id || 'Europe/London', languageCode: initial.language_code || 'en', timeFormat: initial.time_format || 'AUTO'
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const countries = context.countries || [];
  const languages = context.languages || [];
  const country = countries.find((c) => c.country_code === form.countryCode) || countries[0];
  const timezones = useMemo(() => timezonesForCountry(context.timezones || [], form.countryCode), [context.timezones, form.countryCode]);
  const text = namespace(form.languageCode, 'settings');
  const direction = directionFor(form.languageCode);
  const isRtl = direction === 'rtl';

  function set(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function changeCountry(code) {
    const next = countries.find((c) => c.country_code === code);
    if (!next) return;
    setForm((current) => ({ ...current, countryCode: code, locale: next.default_locale, currencyCode: next.default_currency, timezoneId: next.default_timezone, languageCode: next.default_language_code }));
  }

  const preview = useMemo(() => {
    try {
      return {
        dateTime: formatDateTime('2026-09-03T12:30:00Z', { locale: form.locale, timezone: form.timezoneId }),
        annual: formatSalary({ min: form.countryCode === 'IN' ? 1800000 : 120000, currency: form.currencyCode, period: 'ANNUAL', locale: form.locale }),
        monthly: formatSalary({ min: form.countryCode === 'AE' ? 18000 : 8500, currency: form.currencyCode, period: 'MONTHLY', locale: form.locale })
      };
    } catch { return { dateTime: 'Check locale/timezone', annual: '—', monthly: '—' }; }
  }, [form]);

  async function submit(event) {
    event.preventDefault(); if (!canEdit) return;
    setStatus('Saving…'); setError('');
    try {
      const response = await fetch('/api/settings/global', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save settings.');
      setStatus('Saved'); router.refresh();
      setTimeout(() => setStatus(''), 1800);
    } catch (err) { setError(err.message); setStatus(''); }
  }

  return <form className="global-settings-grid" onSubmit={submit} dir={direction}>
    <section className="settings-card settings-form-card">
      <div className="settings-card-head"><div><span className="eyebrow-mini">ISO + IANA + BCP-47</span><h2>{text.title}</h2><p>{text.subtitle}</p></div>{isRtl && <span className="rtl-badge">RTL ready</span>}</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!canEdit && <div className="form-info">Only workspace Owners and Admins can change global operating settings.</div>}
      <div className="settings-fields">
        <CountrySelect label={text.country} name="countryCode" countries={countries} value={form.countryCode} onChange={(e) => changeCountry(e.target.value)} disabled={!canEdit} required />
        <TextInput label={text.locale} name="locale" value={form.locale} onChange={(e) => set('locale', e.target.value)} hint="BCP-47, for example en-US, de-DE or ar-SA" disabled={!canEdit} required />
        <SelectInput label={text.currency} name="currencyCode" value={form.currencyCode} onChange={(e) => set('currencyCode', e.target.value)} options={[...new Set(countries.map((c) => c.default_currency))].sort().map((c) => ({ value: c, label: c }))} disabled={!canEdit} required />
        <TimezoneSelect label={text.timezone} name="timezoneId" timezones={timezones} value={form.timezoneId} onChange={(e) => set('timezoneId', e.target.value)} hint="IANA timezone. DST is calculated by the runtime, never by fixed offsets." disabled={!canEdit} required />
        <SelectInput label={text.language} name="languageCode" value={form.languageCode} onChange={(e) => set('languageCode', e.target.value)} options={languages.map((l) => ({ value: l.language_code, label: `${l.native_name} — ${l.english_name}${l.direction === 'RTL' ? ' · RTL' : ''}` }))} disabled={!canEdit} required />
        <SelectInput label={text.timeFormat} name="timeFormat" value={form.timeFormat} onChange={(e) => set('timeFormat', e.target.value)} options={[{ value: 'AUTO', label: 'Use locale default' }, { value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} disabled={!canEdit} required />
      </div>
      <div className="settings-actions"><button className="btn primary" type="submit" disabled={!canEdit || status === 'Saving…'}>{status || 'Save global settings'}</button><span>Country changes are audit logged.</span></div>
    </section>

    <aside className="settings-card locale-preview" dir={direction}>
      <span className="eyebrow-mini">{text.preview}</span><h3>{country?.country_name || form.countryCode}</h3>
      <div className="preview-row"><span>Date & time</span><b>{preview.dateTime}</b></div>
      <div className="preview-row"><span>Annual salary</span><b>{preview.annual}</b></div>
      <div className="preview-row"><span>Monthly salary</span><b>{preview.monthly}</b></div>
      <div className="preview-row"><span>Document term</span><b>{country?.resume_term || 'CV / Resume'}</b></div>
      <div className="preview-row"><span>Postal field</span><b>{country?.postal_label || 'Postal code'}</b></div>
      <div className="preview-row"><span>Region field</span><b>{country?.region_label || 'Region'}</b></div>
      <div className="preview-row"><span>Working days</span><b>{Array.isArray(country?.working_days) ? country.working_days.join(' · ') : 'Configured by market'}</b></div>
      <div className="timezone-safety"><span>✓</span><p><b>{form.timezoneId}</b><small>Timestamps remain UTC; this timezone controls presentation and scheduling context.</small></p></div>
    </aside>
  </form>;
}
