import { brand } from '../branding';

export async function sendVendorNotifyEmail({
  to,
  plateNumber,
  vehicleType,
  fleetId,
  reportedAt,
  defectPhotoUrls,
}: {
  to: string;
  plateNumber: string;
  vehicleType: string;
  fleetId: string;
  reportedAt: string;
  defectPhotoUrls: string[];
}) {
  if (!process.env.SENDGRID_API_KEY || process.env.EMAIL_ENABLED?.trim() !== 'true') {
    console.warn('[Email] Email disabled or SENDGRID_API_KEY not set, skipping');
    return;
  }

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@songdeegps.com';
  const toList = to.split(',').map(e => e.trim()).filter(Boolean);
  const photos = defectPhotoUrls.filter(u => u && !u.includes('placeholder'));

  const photoHtml = photos.length > 0
    ? `<h3 style="margin-top:16px;">ภาพข้อบกพร่อง / Defect Photos:</h3>
       <div>${photos.map(url =>
         `<img src="${url}" style="max-width:200px;margin:4px;border-radius:4px;border:1px solid #ddd;" />`
       ).join('')}</div>`
    : '<p style="color:#666;font-style:italic;">ไม่มีภาพ / No photos attached</p>';

  await sgMail.send({
    to: toList,
    from: { email: fromEmail, name: brand.appName },
    subject: `[SVIS] แจ้งข้อบกพร่องรถ / Vehicle Defect Report — ${plateNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${brand.primary};padding:16px;">
          <h1 style="margin:0;color:${brand.primaryText};font-size:20px;">${brand.appName} — แจ้งซ่อม / Repair Notice</h1>
        </div>
        <div style="padding:16px;background:#ffffff;">
          <p style="color:#666;margin-top:0;">พบข้อบกพร่องในยานพาหนะที่อยู่ในความดูแลของท่าน กรุณาดำเนินการซ่อมแซมโดยด่วน</p>
          <p style="color:#666;">A defect has been recorded on a vehicle under your care. Please arrange repair as soon as possible.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:8px;font-weight:bold;color:#666;width:40%;">ทะเบียน / Plate:</td><td style="padding:8px;">${plateNumber} (${vehicleType})</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#666;">ฝูงรถ / Fleet:</td><td style="padding:8px;">${fleetId}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;color:#666;">วันที่แจ้ง / Reported:</td><td style="padding:8px;">${reportedAt}</td></tr>
          </table>
          ${photoHtml}
        </div>
        <div style="background:${brand.accent};padding:8px;text-align:center;">
          <span style="color:white;font-size:12px;">${brand.emailFooter}</span>
        </div>
      </div>
    `,
  });
}

export type FailedItemDetail = {
  name: string;
  notes?: string;
  photoUrls?: string[];
};

function cleanPhotos(urls?: string[]): string[] {
  return (urls || []).filter((u) => u && !u.includes('placeholder'));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendInspectionFailEmail({
  to,
  plateNumber,
  vehicleType,
  fleetId,
  inspectorName,
  inspectionDate,
  failedItems,
  photoUrls,
}: {
  to: string;
  plateNumber: string;
  vehicleType: string;
  fleetId: string;
  inspectorName: string;
  inspectionDate: string;
  // Each failed item may carry its own per-item photos + notes. A plain string
  // is accepted for backward compatibility (treated as a name with no details).
  failedItems: (string | FailedItemDetail)[];
  // Inspection-level photos (general "other" evidence), shown in a separate section.
  photoUrls: string[];
}) {
  if (!process.env.SENDGRID_API_KEY || process.env.EMAIL_ENABLED?.trim() !== 'true') {
    console.warn('[Email] Email disabled or SENDGRID_API_KEY not set, skipping');
    return;
  }

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@songdeegps.com';
  const toList = to.split(',').map(e => e.trim()).filter(Boolean);

  const normalized: FailedItemDetail[] = failedItems.map((f) =>
    typeof f === 'string' ? { name: f } : f
  );

  const failedItemsHtml = normalized
    .map((item) => {
      const photos = cleanPhotos(item.photoUrls);
      const photoHtml =
        photos.length > 0
          ? `<div style="margin-top: 6px;">${photos
              .map(
                (url) =>
                  `<img src="${url}" style="max-width: 180px; margin: 4px 4px 0 0; border-radius: 4px; border: 1px solid #ddd;" />`
              )
              .join('')}</div>`
          : '';
      const notesHtml = item.notes
        ? `<div style="margin-top: 4px; color: #666; font-style: italic; font-size: 13px;">${escapeHtml(
            item.notes
          )}</div>`
        : '';
      return `
        <div style="padding: 10px 12px; margin-bottom: 8px; background: #f2fbfd; border-left: 3px solid ${brand.accent}; border-radius: 4px;">
          <div style="font-weight: 600; color: #1A1A1A;">\u2022 ${escapeHtml(item.name)}</div>
          ${notesHtml}
          ${photoHtml}
        </div>
      `;
    })
    .join('');

  const generalPhotos = cleanPhotos(photoUrls);

  await sgMail.send({
    to: toList,
    from: { email: fromEmail, name: brand.appName },
    subject: `[SVIS] Inspection Failed — ${plateNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${brand.primary}; padding: 16px;">
          <h1 style="margin: 0; color: ${brand.primaryText}; font-size: 20px;">${brand.appName} — Inspection Failed</h1>
        </div>
        <div style="padding: 16px; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Vehicle:</td><td style="padding: 8px;">${plateNumber} (${vehicleType})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Fleet:</td><td style="padding: 8px;">${fleetId}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Inspector:</td><td style="padding: 8px;">${inspectorName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Date:</td><td style="padding: 8px;">${inspectionDate}</td></tr>
          </table>
          <h3 style="color: ${brand.accent}; margin-top: 16px;">Failed Items:</h3>
          <div>${failedItemsHtml}</div>
          ${
            generalPhotos.length > 0
              ? `
            <h3 style="margin-top: 16px;">Other Photos:</h3>
            <div>${generalPhotos
              .map(
                (url) =>
                  `<img src="${url}" style="max-width: 200px; margin: 4px; border-radius: 4px;" />`
              )
              .join('')}</div>
          `
              : ''
          }
        </div>
        <div style="background: ${brand.accent}; padding: 8px; text-align: center;">
          <span style="color: white; font-size: 12px;">${brand.emailFooter}</span>
        </div>
      </div>
    `,
  });
}
