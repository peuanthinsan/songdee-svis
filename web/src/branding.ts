import branding from '../branding.json';

export type Branding = {
  appName: string;
  productName: string;
  primary: string;
  accent: string;
  primaryText: string;
};

export const brand: Branding = branding;

type CompanyBranding = {
  companyName?: string;
  primaryColor?: string;
  accentColor?: string;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

function getReadableTextColor(backgroundColor: string) {
  const hex = backgroundColor.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = 0.01033;
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);

  return darkContrast >= whiteContrast ? '#1A1A1A' : '#FFFFFF';
}

export function applyBranding(company?: CompanyBranding) {
  const root = document.documentElement;
  const primary = normalizeColor(company?.primaryColor, brand.primary);
  const accent = normalizeColor(company?.accentColor, brand.accent);

  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-accent', accent);
  root.style.setProperty(
    '--brand-primary-text',
    company ? getReadableTextColor(primary) : brand.primaryText,
  );
  document.title = company?.companyName
    ? `${company.companyName} · ${brand.appName}`
    : `${brand.appName} Dashboard`;
}
