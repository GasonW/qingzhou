export const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent =
    value > 0 ? Math.min(4, Math.floor(Math.log(value) / Math.log(1024))) : 0
  return `${(value / 1024 ** exponent).toLocaleString('zh-CN', { maximumFractionDigits: exponent ? 1 : 0 })} ${units[exponent]}`
}

export const formatDate = (seconds?: number | null) =>
  seconds && seconds > 0
    ? new Date(seconds * 1000).toLocaleDateString('zh-CN')
    : '未提供'
