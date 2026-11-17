import {
  AddOutlined,
  ArrowUpwardOutlined,
  DeleteOutlineOutlined,
  EditOutlined,
  InsertDriveFileOutlined,
  SearchOutlined,
} from '@mui/icons-material'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { useRulesData } from '@/providers/app-data-context'
import {
  readRuleDocument,
  updateRuleDocument,
  type RuleDocument,
  type RuleSection,
} from '@/services/desktop-rules'
import { useQuery } from '@/services/query-client'
import { isValidIpCidr } from '@/utils/network'

import { modes, useClient } from './client-context'
import { withOccurrenceKeys } from './list-keys'
import { ClientDialog, EmptyState, PageHeading } from './ui'

interface CustomRule {
  value: string
  section: RuleSection
  enabled: boolean
  index: number
}

function RuleDialog({
  rule,
  uid,
  onClose,
}: {
  rule?: CustomRule
  uid: string
  onClose: () => void
}) {
  const client = useClient()
  const original = rule?.value.split(',')
  const [kind, setKind] = useState(original?.[0] || 'DOMAIN-SUFFIX')
  const [content, setContent] = useState(original?.[1] || '')
  const [policy, setPolicy] = useState(
    original?.[2] || client.group?.name || 'DIRECT',
  )
  const [noResolve, setNoResolve] = useState(
    Boolean(original?.slice(3).includes('no-resolve')),
  )
  const [validation, setValidation] = useState('')
  const kinds = [
    'DOMAIN-SUFFIX',
    'DOMAIN',
    'DOMAIN-KEYWORD',
    'IP-CIDR',
    'IP-CIDR6',
    'PROCESS-NAME',
  ]
  if (!kinds.includes(kind)) kinds.push(kind)
  const policies = [
    ...new Set([
      'DIRECT',
      'REJECT',
      ...client.groups.map((group) => group.name),
      policy,
    ]),
  ]
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = content.trim()
    if (!value || /[,\r\n]/.test(value)) {
      setValidation('请输入有效匹配内容，不包含逗号或换行。')
      return
    }
    if (
      (kind === 'DOMAIN' || kind === 'DOMAIN-SUFFIX') &&
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(value)
    ) {
      setValidation('请输入域名，不包含协议和路径。')
      return
    }
    if (kind.startsWith('IP-CIDR') && !isValidIpCidr(value)) {
      setValidation('请输入有效 IP 网段，例如 192.168.0.0/16。')
      return
    }
    const next = `${kind},${value},${policy}${noResolve && kind.startsWith('IP-CIDR') ? ',no-resolve' : ''}`
    const applied = await client.perform(
      'rule-save',
      () =>
        updateRuleDocument(uid, (document) => {
          if (!rule) {
            if ([...document.prepend, ...document.append].includes(next))
              throw new Error('已存在相同规则。')
            document.prepend.unshift(next)
          } else if (rule.enabled) {
            const index = document[rule.section].indexOf(rule.value)
            if (index < 0)
              throw new Error('这条规则已被其他操作修改，请关闭后重新打开。')
            document[rule.section][index] = next
          } else {
            const entry = document['qingzhou-disabled-rules'].find(
              (item) =>
                item.value === rule.value && item.section === rule.section,
            )
            if (!entry)
              throw new Error('这条规则已被其他操作修改，请关闭后重新打开。')
            entry.value = next
          }
        }),
      '规则已保存',
    )
    if (applied) onClose()
  }
  return (
    <ClientDialog
      title={rule ? '编辑规则' : '添加规则'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form="qingzhou-rule-form"
            className="q-btn q-primary"
            disabled={Boolean(client.busy)}
          >
            保存规则
          </button>
        </>
      }
    >
      <form
        id="qingzhou-rule-form"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <label className="q-field">
          匹配类型
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {kinds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="q-field">
          匹配内容
          <input
            className="q-input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            placeholder="example.com"
          />
        </label>
        <label className="q-field">
          访问方式
          <select
            value={policy}
            onChange={(event) => setPolicy(event.target.value)}
          >
            {policies.map((item) => (
              <option value={item} key={item}>
                {item === 'DIRECT' ? '直连' : item === 'REJECT' ? '拦截' : item}
              </option>
            ))}
          </select>
        </label>
        {kind.startsWith('IP-CIDR') && (
          <label className="q-inline q-muted">
            <input
              type="checkbox"
              checked={noResolve}
              onChange={(event) => setNoResolve(event.target.checked)}
            />
            不为匹配网段额外解析域名
          </label>
        )}
        {(validation || client.error) && (
          <p className="q-error" role="alert">
            {validation || client.error}
          </p>
        )}
      </form>
    </ClientDialog>
  )
}

function EffectiveRulesDialog({ onClose }: { onClose: () => void }) {
  const { rules } = useRulesData()
  const [search, setSearch] = useState('')
  const typeLabel = (rule: (typeof rules)[number]) =>
    typeof rule.type === 'string' ? rule.type : rule.type.Unknown
  const filtered = rules.filter((rule) =>
    `${typeLabel(rule)} ${rule.payload} ${rule.proxy}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  return (
    <ClientDialog title="内核生效规则" onClose={onClose}>
      <label className="q-search">
        <SearchOutlined />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索匹配内容或策略"
          aria-label="搜索生效规则"
        />
      </label>
      <p className="q-note">
        共 {filtered.length} 条，显示前 100
        条匹配结果。实际访问命中的规则可在连接记录中查看。
      </p>
      {withOccurrenceKeys(
        filtered.slice(0, 100),
        (rule) => `${typeLabel(rule)}:${rule.payload}:${rule.proxy}`,
      ).map(({ key, value: rule }) => (
        <div className="q-rule-row" key={key}>
          <div className="q-rule-copy">
            <span>{rule.payload || typeLabel(rule)}</span>
            <span className="q-node-meta">{typeLabel(rule)}</span>
          </div>
          <span className="q-pill">{rule.proxy}</span>
        </div>
      ))}
    </ClientDialog>
  )
}

export function RulesPanel() {
  const client = useClient()
  const navigate = useNavigate()
  const uid = client.current?.option?.rules
  const query = useQuery({
    queryKey: ['desktop-rules', uid],
    queryFn: () => readRuleDocument(uid!),
    enabled: Boolean(uid),
    refetchOnWindowFocus: false,
  })
  const [dialog, setDialog] = useState<'new' | 'effective' | CustomRule | null>(
    null,
  )
  const document = query.data
  const rows: CustomRule[] = document
    ? [
        ...document.prepend.map((value, index) => ({
          value,
          section: 'prepend' as const,
          enabled: true,
          index,
        })),
        ...document.append.map((value, index) => ({
          value,
          section: 'append' as const,
          enabled: true,
          index,
        })),
        ...document['qingzhou-disabled-rules'].map((item) => ({
          ...item,
          enabled: false,
        })),
      ]
    : []
  const update = (operation: (document: RuleDocument) => void) => {
    if (uid)
      void client.perform('rule-update', () =>
        updateRuleDocument(uid, operation),
      )
  }
  return (
    <>
      <PageHeading title="分流规则" />
      <div className="q-banner">
        <span>
          当前模式：<b>{client.mode ? modes[client.mode].name : '正在读取'}</b>
          {client.mode && client.mode !== 'rule' ? ' · 分流规则未启用' : ''}
        </span>
        {client.mode !== 'rule' && (
          <button
            type="button"
            className="q-link"
            disabled={Boolean(client.busy)}
            onClick={() => {
              void client.setMode('rule')
            }}
          >
            启用规则分流
          </button>
        )}
      </div>
      <div className="q-stack">
        <section className="q-box">
          <div className="q-boxhead">
            <h2>当前配置文件</h2>
            <button
              type="button"
              className="q-link"
              onClick={() => {
                void navigate('/profile')
              }}
            >
              {client.current ? '更换配置' : '添加配置'}
            </button>
          </div>
          {client.current ? (
            <>
              <div className="q-inline">
                <InsertDriveFileOutlined />
                <h3>{client.current.file}</h3>
              </div>
              <p className="q-subtitle">来源：{client.current.name}</p>
            </>
          ) : (
            <p className="q-muted">未选择配置文件</p>
          )}
        </section>
        <section className="q-box">
          <div className="q-boxhead">
            <h2>自定义规则</h2>
            <div className="q-inline">
              <span className="q-muted">{rows.length} 条</span>
              <button
                type="button"
                className="q-btn q-primary"
                disabled={!uid || Boolean(client.busy)}
                onClick={() => setDialog('new')}
              >
                <AddOutlined />
                添加规则
              </button>
            </div>
          </div>
          <p className="q-muted">
            新增规则优先于配置文件中的规则，订阅更新后保留。
          </p>
          {query.error && (
            <p className="q-error" role="alert">
              {String(query.error)}
            </p>
          )}
          {uid && !document && !query.error ? (
            <p className="q-note">正在读取规则…</p>
          ) : rows.length ? (
            withOccurrenceKeys(
              rows,
              (rule) => `${rule.section}:${rule.enabled}:${rule.value}`,
            ).map(({ key, value: rule }) => {
              const parts = rule.value.split(',')
              return (
                <div className="q-rule-row" key={key}>
                  <label className="q-toggle">
                    <input
                      type="checkbox"
                      aria-label={`启用 ${parts[1]}`}
                      checked={rule.enabled}
                      disabled={Boolean(client.busy)}
                      onChange={() =>
                        update((draft) => {
                          if (rule.enabled) {
                            const index = draft[rule.section].indexOf(
                              rule.value,
                            )
                            if (index < 0)
                              throw new Error('规则已变化，请刷新后重试。')
                            draft[rule.section].splice(index, 1)
                            draft['qingzhou-disabled-rules'].push({
                              value: rule.value,
                              section: rule.section,
                              index,
                            })
                          } else {
                            const disabled = draft[
                              'qingzhou-disabled-rules'
                            ].find(
                              (item) =>
                                item.value === rule.value &&
                                item.section === rule.section,
                            )
                            if (!disabled)
                              throw new Error('规则已变化，请刷新后重试。')
                            draft[rule.section].splice(
                              Math.min(
                                disabled.index,
                                draft[rule.section].length,
                              ),
                              0,
                              rule.value,
                            )
                            draft['qingzhou-disabled-rules'] = draft[
                              'qingzhou-disabled-rules'
                            ].filter((item) => item !== disabled)
                          }
                        })
                      }
                    />
                  </label>
                  <div className="q-rule-copy">
                    <span>{parts[1] || rule.value}</span>
                    <span className="q-node-meta">
                      {parts[0]}
                      {rule.section === 'append' ? ' · 末尾规则' : ''}
                    </span>
                  </div>
                  <span
                    className={`q-pill ${parts[2] !== 'DIRECT' ? 'blue' : ''}`}
                  >
                    {parts[2] === 'DIRECT'
                      ? '直连'
                      : parts[2] === 'REJECT'
                        ? '拦截'
                        : parts[2]}
                  </span>
                  <button
                    type="button"
                    className="q-icon"
                    aria-label={`编辑 ${parts[1]}`}
                    onClick={() => setDialog(rule)}
                  >
                    <EditOutlined />
                  </button>
                  <button
                    type="button"
                    className="q-icon"
                    aria-label={`上移 ${parts[1]}`}
                    disabled={
                      !rule.enabled || rule.index === 0 || Boolean(client.busy)
                    }
                    onClick={() =>
                      update((draft) => {
                        const index = draft[rule.section].indexOf(rule.value)
                        if (index > 0)
                          [
                            draft[rule.section][index - 1],
                            draft[rule.section][index],
                          ] = [
                            draft[rule.section][index],
                            draft[rule.section][index - 1],
                          ]
                      })
                    }
                  >
                    <ArrowUpwardOutlined />
                  </button>
                  <button
                    type="button"
                    className="q-icon q-danger"
                    aria-label={`删除 ${parts[1]}`}
                    disabled={Boolean(client.busy)}
                    onClick={() =>
                      update((draft) => {
                        if (rule.enabled) {
                          const index = draft[rule.section].indexOf(rule.value)
                          if (index >= 0) draft[rule.section].splice(index, 1)
                        } else
                          draft['qingzhou-disabled-rules'] = draft[
                            'qingzhou-disabled-rules'
                          ].filter(
                            (item) =>
                              item.value !== rule.value ||
                              item.section !== rule.section,
                          )
                      })
                    }
                  >
                    <DeleteOutlineOutlined />
                  </button>
                </div>
              )
            })
          ) : (
            <EmptyState
              title="暂无自定义规则"
              description={uid ? '点击“添加规则”创建。' : '请先选择一份配置。'}
            />
          )}
        </section>
        <button
          type="button"
          className="q-btn"
          onClick={() => setDialog('effective')}
        >
          <SearchOutlined />
          查看生效规则
        </button>
      </div>
      {uid &&
        (dialog === 'new' ||
          (dialog !== null && typeof dialog === 'object')) && (
          <RuleDialog
            uid={uid}
            rule={typeof dialog === 'object' ? dialog! : undefined}
            onClose={() => setDialog(null)}
          />
        )}
      {dialog === 'effective' && (
        <EffectiveRulesDialog onClose={() => setDialog(null)} />
      )}
    </>
  )
}
