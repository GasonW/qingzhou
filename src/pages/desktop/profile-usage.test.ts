import { describe, expect, it } from 'vitest'

import { usageDetails } from './profile-usage'

const profile = (extra?: IProfileItem['extra']): IProfileItem => ({
  type: 'remote',
  uid: 'usage-test',
  name: 'Usage test',
  file: 'usage-test.yaml',
  updated: 0,
  extra,
})

const empty = { upload: 0, download: 0, total: 0, expire: 0 }

describe('subscription usage information', () => {
  it('shows a progress bar only when quota and usage are both known', () => {
    const result = usageDetails(
      profile({
        ...empty,
        total: 400,
        download: 100,
        total_provided: true,
        usage_provided: true,
      }),
    )
    expect(result.ratio).toBe(25)
  })

  it('keeps known zero usage distinct from missing usage', () => {
    expect(
      usageDetails(
        profile({
          ...empty,
          total: 400,
          total_provided: true,
          usage_provided: true,
        }),
      ).ratio,
    ).toBe(0)
    expect(
      usageDetails(
        profile({
          ...empty,
          total: 400,
          total_provided: true,
          usage_provided: false,
        }),
      ).ratio,
    ).toBeUndefined()
  })

  it('shows explicit unlimited quota without a percentage bar', () => {
    const result = usageDetails(
      profile({
        ...empty,
        total_provided: true,
        usage_provided: true,
      }),
    )
    expect(result.label).toContain('不限流量')
    expect(result.ratio).toBeUndefined()
  })

  it('does not interpret absent quota as unlimited', () => {
    const result = usageDetails(
      profile({
        ...empty,
        download: 100,
        total_provided: false,
        usage_provided: true,
      }),
    )
    expect(result.label).toContain('未提供流量上限')
    expect(result.label).not.toContain('不限流量')
    expect(result.ratio).toBeUndefined()
  })

  it('handles subscriptions with no information and legacy zero values', () => {
    expect(usageDetails(profile()).label).toBe('未提供流量信息')
    expect(usageDetails(profile(empty)).label).toBe('未提供流量信息')
    expect(usageDetails(profile()).expire).toBe('未提供到期时间')
  })
})
