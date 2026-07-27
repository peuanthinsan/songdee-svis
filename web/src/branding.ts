import branding from '../branding.json';

export type Branding = {
  appName: string;
  productName: string;
  primary: string;
  accent: string;
  primaryText: string;
};

export const brand: Branding = branding;

export function applyBranding() {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', brand.primary);
  root.style.setProperty('--brand-accent', brand.accent);
  root.style.setProperty('--brand-primary-text', brand.primaryText);
  document.title = `${brand.appName} Dashboard`;
}
