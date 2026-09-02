import type { Lang } from './i18n';

export type FailedChecklistItem = {
  checklist_item_id: string;
  item_name_th: string;
  item_name_en: string;
  section?: string | null;
  notes?: string;
  photo_urls?: string[];
};

export function localizedFailedChecklistItemLabel(item: FailedChecklistItem, lang: Lang): string {
  const preferred = (lang === 'th' ? item.item_name_th : item.item_name_en).trim();
  const fallback = (lang === 'th' ? item.item_name_en : item.item_name_th).trim();
  return preferred || fallback;
}

export function localizedFailedChecklistItemLabels(
  items: FailedChecklistItem[] | undefined,
  lang: Lang,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    const label = localizedFailedChecklistItemLabel(item, lang);
    const normalized = label.toLocaleLowerCase();
    if (!label || seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(label);
  }

  return labels;
}

export function partitionFailedChecklistPhotos(
  items: FailedChecklistItem[] | undefined,
  defectPhotoUrls: string[] | undefined,
): { mappedItems: FailedChecklistItem[]; unassociatedUrls: string[] } {
  const mappedItems = (items ?? []).filter((item) => (item.photo_urls?.length ?? 0) > 0);
  const mappedUrls = new Set(mappedItems.flatMap((item) => item.photo_urls ?? []));
  const unassociatedUrls = (defectPhotoUrls ?? []).filter((url) => !mappedUrls.has(url));
  return { mappedItems, unassociatedUrls };
}
