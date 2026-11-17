import { formatBytes, formatDate } from './format'

export function usageDetails(item: IProfileItem) {
  const extra = item.extra
  if (!extra)
    return {
      label: '未提供流量信息',
      ratio: undefined,
      expire: '未提供到期时间',
    }
  const used = extra.upload + extra.download
  const hasUsage =
    ('usage_provided' in extra && extra.usage_provided === true) || used > 0
  const explicitTotal =
    'total_provided' in extra && extra.total_provided === true
  const quota =
    extra.total > 0
      ? `${hasUsage ? formatBytes(used) + ' / ' : '总额 '}${formatBytes(extra.total)}`
      : explicitTotal
        ? `不限流量${hasUsage ? ' · 已用 ' + formatBytes(used) : ''}`
        : hasUsage
          ? `已用 ${formatBytes(used)} · 未提供流量上限`
          : '未提供流量信息'
  return {
    label: quota,
    ratio:
      extra.total > 0 && hasUsage
        ? Math.min(100, (used / extra.total) * 100)
        : undefined,
    expire:
      extra.expire > 0 ? `${formatDate(extra.expire)} 到期` : '未提供到期时间',
  }
}

export const profileUsageLabel = (item: IProfileItem) =>
  usageDetails(item).label
