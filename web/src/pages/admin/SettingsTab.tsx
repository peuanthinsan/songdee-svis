import { useEffect, useState } from 'react';
import { fetchAdminSettings, saveAdminSetting } from '../../api';
import { t } from '../../i18n';

export function SettingsTab() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminSettings()
      .then((d) => { setUrl(d.unit_status_sheet_url || ''); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false); setError('');
    try {
      await saveAdminSetting('unit_status_sheet_url', url);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginBottom: 20 }}>{t('adminSettings')}</h2>
      {loading ? (
        <p className="muted">{t('loading')}</p>
      ) : (
        <div style={{ maxWidth: 560, display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>
            {t('unitStatusSheetUrl')}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/pub?output=csv"
              style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: '#fafafa', fontSize: 14 }}
            />
            <span className="muted" style={{ fontSize: 12 }}>{t('sheetUrlHint')}</span>
          </label>
          {error && <div className="alert alert--error">{error}</div>}
          {saved && <div className="alert" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{t('saved')} ✓</div>}
          <div>
            <button type="button" className="btn btn--accent" onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
