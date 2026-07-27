import { useState } from 'react';

type Props = {
  urls: string[];
  label?: string;
  maxThumb?: number;
};

export function PhotoGrid({ urls, label, maxThumb = 200 }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  function prev() { setLightbox((i) => (i !== null ? Math.max(0, i - 1) : null)); }
  function next() { setLightbox((i) => (i !== null ? Math.min(urls.length - 1, i + 1) : null)); }

  return (
    <div>
      {label && <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {urls.map((url, i) => (
          <img
            key={url + i}
            src={url}
            alt=""
            loading="lazy"
            onClick={() => setLightbox(i)}
            style={{
              width: maxThumb, height: maxThumb, objectFit: 'cover', borderRadius: 8,
              cursor: 'zoom-in', border: '1px solid var(--border)', background: '#eee',
            }}
          />
        ))}
      </div>

      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16,
          }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            disabled={lightbox === 0}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '12px 16px', fontSize: 20, cursor: 'pointer', opacity: lightbox === 0 ? 0.3 : 1 }}
          >‹</button>
          <img
            src={urls[lightbox]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            disabled={lightbox === urls.length - 1}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '12px 16px', fontSize: 20, cursor: 'pointer', opacity: lightbox === urls.length - 1 ? 0.3 : 1 }}
          >›</button>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 18 }}
          >✕</button>
          <div style={{ position: 'absolute', bottom: 16, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {lightbox + 1} / {urls.length}
          </div>
        </div>
      )}
    </div>
  );
}
