export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`;
  const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href);
}
