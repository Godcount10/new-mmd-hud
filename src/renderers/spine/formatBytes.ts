export function formatMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '大小未知'
  const megabytes = bytes / 1_000_000
  return `约 ${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`
}
