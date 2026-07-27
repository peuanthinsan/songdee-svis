/**
 * Canonical per-customer branding for the non-web code (Expo app, serverless API,
 * shared lib). The single source of truth is web/branding.json — the web SPA reads
 * the same file via web/src/branding.ts. Everything that used to hard-code the
 * customer name, brand colors, xlsx filename, or email footer imports from here, so
 * re-branding a deployment means editing one JSON file instead of five.
 */
import branding from './web/branding.json';

export type Branding = {
  appName: string;
  productName: string;
  primary: string;
  accent: string;
  primaryText: string;
  /** Lowercase prefix for exported files, e.g. `<fileSlug>-issues-2026-07-08.xlsx`. */
  fileSlug: string;
  /** Full footer line rendered at the bottom of notification emails. */
  emailFooter: string;
};

export const brand: Branding = branding as Branding;

/**
 * ExcelJS colors are 8-digit ARGB (opaque alpha + RGB); branding stores 6-digit
 * `#RRGGBB`. Convert `#RRGGBB` → `FFRRGGBB` so brand colors drive spreadsheet styling.
 */
export function toArgb(hexColor: string): string {
  return `FF${hexColor.replace('#', '').toUpperCase()}`;
}
