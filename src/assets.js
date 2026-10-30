/** Resolve public assets under the Vite base, including GitHub Pages subpaths. */
export function assetUrl(path) {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}
