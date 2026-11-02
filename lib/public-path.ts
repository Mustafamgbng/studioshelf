// Keep saved project paths portable. Add a deployment prefix only at the point
// a local public asset (or a raw internal link) is requested by the browser.
export function publicPath(source: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH || '') {
  const prefix = basePath.replace(/\/+$/, '');
  if (
    !prefix ||
    !/^\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/.test(prefix) ||
    !source.startsWith('/') ||
    source.startsWith('//') ||
    source === prefix ||
    source.startsWith(`${prefix}/`) ||
    source.startsWith(`${prefix}?`) ||
    source.startsWith(`${prefix}#`)
  )
    return source;
  return `${prefix}${source}`;
}
