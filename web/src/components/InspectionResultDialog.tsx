import { useEffect, useState } from 'react';
import { fetchInspectionDetail, type InspectionDetail } from '../api';
import { getLang, t } from '../i18n';
import { PhotoGrid } from './PhotoGrid';
import { formatDateThai } from '../lib/format-date';

function frequencyLabel(frequency?: InspectionDetail['frequency']) {
  if (frequency === 'weekly') return t('weekly');
  if (frequency === 'post_route') return t('postRoute');
  return t('daily');
}

export function InspectionResultDialog({ inspectionId, onClose }: { inspectionId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState(false);
  const locale = getLang();

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(false);
    fetchInspectionDetail(inspectionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [inspectionId, onClose]);

  return (
    <div className="inspection-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="inspection-result-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-result-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inspection-result-dialog__header">
          <div>
            <span className="section-label">{t('savedInspection')}</span>
            <h2 id="inspection-result-title">{detail?.plate_number || t('inspectionResult')}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t('close')}>×</button>
        </header>

        {!detail && !error && <div className="inspection-result-dialog__loading">{t('loading')}</div>}
        {error && <div className="alert alert--error">{t('inspectionLoadError')}</div>}

        {detail && (
          <div className="inspection-result-dialog__body">
            <div className="inspection-result-dialog__summary">
              <div>
                <span>{t('inspectionType')}</span>
                <strong>{frequencyLabel(detail.frequency)}</strong>
              </div>
              <div>
                <span>{t('date')}</span>
                <strong>{formatDateThai(detail.inspection_date)}</strong>
              </div>
              <div>
                <span>{t('inspector')}</span>
                <strong>{detail.inspector_name || '—'}</strong>
              </div>
              <div>
                <span>{t('status')}</span>
                <strong className={detail.overall_status === 'fail' ? 'text-fail' : 'text-pass'}>
                  {detail.overall_status === 'fail' ? t('failLabel') : t('passLabel')}
                </strong>
              </div>
              <div>
                <span>{t('mileage')}</span>
                <strong>{typeof detail.mileage === 'number' ? `${detail.mileage.toLocaleString()} km` : '—'}</strong>
              </div>
              <div>
                <span>{t('vehicleUsable')}</span>
                <strong>{detail.vehicle_usable === true ? t('usable') : detail.vehicle_usable === false ? t('notUsable') : '—'}</strong>
              </div>
            </div>

            {(detail.odometer_photo_url || (detail.photo_urls?.length ?? 0) > 0) && (
              <div className="inspection-result-dialog__photos">
                {detail.odometer_photo_url && (
                  <PhotoGrid urls={[detail.odometer_photo_url]} label={t('odometerPhoto')} maxThumb={126} />
                )}
                {(detail.photo_urls?.length ?? 0) > 0 && (
                  <PhotoGrid urls={detail.photo_urls!} label={t('inspectionPhotos')} maxThumb={126} />
                )}
              </div>
            )}

            {detail.notes && (
              <div className="inspection-result-dialog__notes">
                <span className="section-label">{t('notes')}</span>
                <p>{detail.notes}</p>
              </div>
            )}

            <div>
              <div className="inspection-result-dialog__section-head">
                <h3>{t('checklistResults')}</h3>
                <span>{t('itemCount', { count: String(detail.results?.length ?? 0) })}</span>
              </div>
              <div className="inspection-result-list">
                {(detail.results ?? []).map((result, index) => (
                  <article
                    className={`inspection-result-row inspection-result-row--${result.result === 'fail' ? 'fail' : 'pass'}`}
                    key={result.id || `${inspectionId}-${index}`}
                  >
                    <span className="inspection-result-row__index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="inspection-result-row__copy">
                      <strong>{locale === 'th' ? result.item_name_th : result.item_name_en}</strong>
                      <span>{locale === 'th' ? result.item_name_en : result.item_name_th}</span>
                      {result.notes && <p>{result.notes}</p>}
                      {(result.photo_urls?.length ?? 0) > 0 && (
                        <PhotoGrid urls={result.photo_urls!} maxThumb={88} />
                      )}
                    </div>
                    <span className={`inspection-result-row__status inspection-result-row__status--${result.result}`}>
                      {result.result === 'fail' ? t('failLabel') : t('passLabel')}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
