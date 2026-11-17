import { dump, load } from 'js-yaml'

import { readProfileFile, saveProfileFile } from './cmds'
import { mutate } from './mutate'

export type RuleSection = 'prepend' | 'append'
export interface DisabledRule {
  value: string
  section: RuleSection
  index: number
}
export interface RuleDocument extends Record<string, unknown> {
  prepend: string[]
  append: string[]
  delete: string[]
  'qingzhou-disabled-rules': DisabledRule[]
}

export async function readRuleDocument(uid: string): Promise<RuleDocument> {
  const value = load(await readProfileFile(uid))
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== 'object' || Array.isArray(value))
  ) {
    throw new Error('规则覆写文件必须是 YAML 对象。')
  }
  const document = (value || {}) as Record<string, unknown>
  const list = (key: string) => {
    const values = document[key] ?? []
    if (
      !Array.isArray(values) ||
      values.some((item) => typeof item !== 'string')
    ) {
      throw new Error(`规则覆写中的 ${key} 必须是字符串列表。`)
    }
    return values as string[]
  }
  return {
    ...document,
    prepend: list('prepend'),
    append: list('append'),
    delete: list('delete'),
    'qingzhou-disabled-rules': (document['qingzhou-disabled-rules'] ??
      []) as DisabledRule[],
  }
}

export async function updateRuleDocument(
  uid: string,
  update: (document: RuleDocument) => void,
) {
  const result = await mutate(
    async () => {
      const document = await readRuleDocument(uid)
      update(document)
      const saved = await saveProfileFile(uid, dump(document))
      if (!saved)
        throw new Error('规则未通过内核校验，请检查匹配内容和策略名称。')
    },
    {
      id: `save-profile-file:${uid}`,
      errorNotice: false,
      revalidate: [['desktop-rules', uid], ['getRules'], ['getRuntimeConfig']],
    },
  )
  if (!result.ok) throw new Error('配置正在更新，请稍后重试。')
}
