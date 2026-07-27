import { useEffect, useState } from 'react';
import { AdminUser, fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../api';
import { t } from '../../i18n';

type Form = { username: string; password: string; firstName: string; lastName: string; role: string; fleetId: string };
const BLANK: Form = { username: '', password: '', firstName: '', lastName: '', role: 'driver', fleetId: '' };

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | AdminUser | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load(q?: string) {
    setLoading(true);
    fetchAdminUsers({ search: q, limit: 200 })
      .then((data) => { setUsers(data); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(() => load(), []);

  function openCreate() { setForm(BLANK); setModal('create'); setError(''); }
  function openEdit(u: AdminUser) {
    setForm({ username: u.username, password: '', firstName: u.first_name, lastName: u.last_name, role: u.role, fleetId: u.fleet_id || '' });
    setModal(u); setError('');
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        const u = await createAdminUser({ ...form, fleetId: form.fleetId || undefined });
        setUsers((prev) => [u, ...prev]);
      } else if (modal) {
        const payload: Parameters<typeof updateAdminUser>[1] = {
          firstName: form.firstName, lastName: form.lastName, role: form.role, fleetId: form.fleetId || undefined,
        };
        if (form.password) payload.password = form.password;
        const updated = await updateAdminUser(modal.id, payload);
        setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
      }
      setModal(null);
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`${t('confirmDelete')} ${u.username}?`)) return;
    try {
      await deleteAdminUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      alert(e.message || t('error'));
    }
  }

  const roleLabel: Record<string, string> = { driver: t('driver'), supervisor: t('supervisor'), admin: t('admin') };
  const filtered = users.filter((u) =>
    !search || [u.username, u.first_name, u.last_name, u.fleet_id || ''].some((v) => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminUsers')}</h2>
        <input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 14 }}
        />
        <button type="button" className="btn btn--accent" style={{ padding: '8px 16px' }} onClick={openCreate}>
          + {t('add')}
        </button>
      </div>
      {loading ? (
        <p className="muted" style={{ padding: 20 }}>{t('loading')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>{t('username')}</th><th>{t('firstName')}</th><th>{t('lastName')}</th><th>{t('role')}</th><th>{t('fleetId')}</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="table-empty">{t('noResults')}</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.first_name}</td>
                <td>{u.last_name}</td>
                <td><span className="badge badge--open">{roleLabel[u.role] || u.role}</span></td>
                <td className="muted">{u.fleet_id || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn--secondary" style={{ padding: '5px 10px', marginRight: 6 }} onClick={() => openEdit(u)}>{t('editAction')}</button>
                  <button type="button" className="btn" style={{ padding: '5px 10px', background: '#fde', color: '#c00' }} onClick={() => handleDelete(u)}>{t('deleteAction')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--panel)', borderRadius: 16, padding: 28, width: 'min(460px, 95vw)', display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0 }}>{modal === 'create' ? `+ ${t('adminUsers')}` : `${t('editAction')} ${(modal as AdminUser).username}`}</h3>
            {error && <div className="alert alert--error">{error}</div>}
            {['firstName', 'lastName', 'fleetId'].map((field) => (
              <label key={field} style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {t(field as 'firstName')}
                <input
                  value={(form as any)[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}
                />
              </label>
            ))}
            {modal === 'create' && (
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {t('username')}
                <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
              </label>
            )}
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {modal === 'create' ? t('password') : t('newPassword')}
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('role')}
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                <option value="driver">{t('driver')}</option>
                <option value="supervisor">{t('supervisor')}</option>
                <option value="admin">{t('admin')}</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn--accent" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
