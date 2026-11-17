import {
  AddOutlined,
  EditOutlined,
  LayersOutlined,
  RefreshOutlined,
} from '@mui/icons-material'
import { dump, load } from 'js-yaml'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { fetchProfilesIntoCache } from '@/hooks/use-profiles'
import {
  createProfile,
  deleteProfile,
  patchProfile,
  readProfileFile,
  saveProfileFile,
  updateProfile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { useQuery } from '@/services/query-client'
import parseUri from '@/utils/uri-parser'

import { useClient } from './client-context'
import { formatDate } from './format'
import { usageDetails } from './profile-usage'
import { ClientDialog, EmptyState, PageHeading } from './ui'

async function refreshCreatedProfile(
  client: ReturnType<typeof useClient>,
  previousIds: Set<string | null>,
) {
  const latest = await fetchProfilesIntoCache()
  if (!latest.current) {
    const created = latest.items?.find(
      (item) =>
        item.uid &&
        !previousIds.has(item.uid) &&
        ['remote', 'local'].includes(item.type || ''),
    )
    if (created?.uid) {
      const result = await client.patchProfiles({ current: created.uid })
      if (result.status !== 'valid')
        throw new Error(
          result.status === 'invalid'
            ? result.message
            : '配置已添加，但暂未启用。请在订阅页重试。',
        )
    }
  }
  await client.refreshAll()
}

function ProfileDialog({
  item,
  onClose,
}: {
  item?: IProfileItem
  onClose: () => void
}) {
  const client = useClient()
  const [kind, setKind] = useState<'remote' | 'local'>(
    item?.type === 'local' ? 'local' : 'remote',
  )
  const [name, setName] = useState(item?.name || '')
  const [url, setUrl] = useState(item?.url || '')
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidation('')
    if (!name.trim()) {
      setValidation('请输入名称。')
      return
    }
    if (kind === 'remote') {
      try {
        if (!['http:', 'https:'].includes(new URL(url).protocol))
          throw new Error()
      } catch {
        setValidation('请输入有效的 http:// 或 https:// 订阅链接。')
        return
      }
    }
    if (!item && kind === 'local' && !file) {
      setValidation('请选择 YAML 配置文件。')
      return
    }
    const applied = await client.perform(
      'profile-save',
      async () => {
        if (item?.uid) {
          await mutate(
            () =>
              patchProfile(item.uid!, {
                name: name.trim(),
                ...(kind === 'remote' ? { url: url.trim() } : {}),
              }),
            {
              id: `patch-profile:${item.uid}`,
              errorNotice: false,
              revalidate: [['getProfiles']],
            },
          )
        } else {
          const fileData = kind === 'local' ? await file!.text() : null
          if (
            fileData !== null &&
            (!load(fileData) || !/\.ya?ml$/i.test(file!.name))
          )
            throw new Error('请选择有效的 YAML 配置文件。')
          const previousIds = new Set(
            (client.profiles?.items || []).map((profile) => profile.uid),
          )
          await mutate(
            () =>
              createProfile(
                {
                  type: kind,
                  name: name.trim(),
                  ...(kind === 'remote' ? { url: url.trim() } : {}),
                  option: {
                    with_proxy: false,
                    self_proxy: false,
                    allow_auto_update: kind === 'remote',
                    update_interval: 1440,
                  },
                },
                fileData,
              ),
            {
              id: 'create-profile',
              errorNotice: false,
            },
          )
          await refreshCreatedProfile(client, previousIds)
        }
      },
      item ? '配置已保存' : '配置已添加',
    )
    if (applied) onClose()
  }
  return (
    <ClientDialog
      title={item ? '编辑订阅' : '添加订阅'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form="qingzhou-profile-form"
            className="q-btn q-primary"
            disabled={Boolean(client.busy)}
          >
            {client.busy === 'profile-save'
              ? '保存中…'
              : item
                ? '保存'
                : '导入'}
          </button>
        </>
      }
    >
      <form
        id="qingzhou-profile-form"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        {!item && (
          <div className="q-tabs">
            <button
              type="button"
              className="q-tab"
              aria-pressed={kind === 'remote'}
              onClick={() => setKind('remote')}
            >
              订阅链接
            </button>
            <button
              type="button"
              className="q-tab"
              aria-pressed={kind === 'local'}
              onClick={() => setKind('local')}
            >
              配置文件
            </button>
          </div>
        )}
        <label className="q-field">
          名称
          <input
            className="q-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
          />
        </label>
        {kind === 'remote' ? (
          <label className="q-field">
            订阅链接
            <input
              className="q-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              type="url"
              required
              placeholder="https://example.com/subscribe"
            />
          </label>
        ) : (
          !item && (
            <label className="q-field">
              YAML 配置文件
              <input
                className="q-input"
                type="file"
                accept=".yaml,.yml"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          )
        )}
        {validation && (
          <p className="q-error" role="alert">
            {validation}
          </p>
        )}
        {client.error && (
          <p className="q-error" role="alert">
            {client.error}
          </p>
        )}
      </form>
    </ClientDialog>
  )
}

export function ManualNodeDialog({ onClose }: { onClose: () => void }) {
  const client = useClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [uri, setUri] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const applied = await client.perform(
      'manual-node',
      async () => {
        const proxy = parseUri(uri.trim())
        if (name.trim()) proxy.name = name.trim()
        if (!proxy.name) throw new Error('请输入节点名称。')
        if (
          client.proxyView &&
          Object.values(client.proxyView.records).some(
            (node) => node.name === proxy.name,
          )
        )
          throw new Error('已有同名节点，请使用其他名称。')
        const uid = client.current?.option?.proxies
        if (uid) {
          const result = await mutate(
            async () => {
              const document = (load(await readProfileFile(uid)) ||
                {}) as Record<string, unknown>
              const prepend = Array.isArray(document.prepend)
                ? document.prepend
                : []
              return saveProfileFile(
                uid,
                dump({
                  ...document,
                  prepend: [proxy, ...prepend],
                  append: document.append || [],
                  delete: document.delete || [],
                }),
              )
            },
            { id: `save-profile-file:${uid}`, errorNotice: false },
          )
          if (!result.value) throw new Error('节点未通过配置校验，请检查链接。')
          await client.refreshAll()
        } else {
          const groupName =
            proxy.name === '手动代理' ? '手动代理组' : '手动代理'
          const data = dump({
            proxies: [proxy],
            'proxy-groups': [
              {
                name: groupName,
                type: 'select',
                proxies: [proxy.name, 'DIRECT'],
              },
            ],
            rules: [`MATCH,${groupName}`],
          })
          const previousIds = new Set(
            (client.profiles?.items || []).map((profile) => profile.uid),
          )
          await mutate(
            () =>
              createProfile(
                {
                  type: 'local',
                  name: '手动节点',
                  option: { allow_auto_update: false },
                },
                data,
              ),
            { id: 'create-profile', errorNotice: false },
          )
          await refreshCreatedProfile(client, previousIds)
        }
      },
      '节点已添加',
    )
    if (applied) {
      onClose()
      void navigate('/proxies')
    }
  }
  return (
    <ClientDialog
      title="手动添加节点"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form="qingzhou-node-form"
            className="q-btn q-primary"
            disabled={Boolean(client.busy)}
          >
            添加节点
          </button>
        </>
      }
    >
      <form
        id="qingzhou-node-form"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <p className="q-muted">
          {client.current
            ? `添加到「${client.current.name}」的节点覆写中，订阅更新后保留。`
            : '将创建一份本地节点配置。'}
        </p>
        <label className="q-field">
          节点名称
          <input
            className="q-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="可选，留空使用链接中的名称"
          />
        </label>
        <label className="q-field">
          节点分享链接
          <textarea
            className="q-input"
            value={uri}
            onChange={(event) => setUri(event.target.value)}
            required
            placeholder="ss://…、trojan://…、vless://…"
          />
        </label>
        {client.error && (
          <p className="q-error" role="alert">
            {client.error}
          </p>
        )}
      </form>
    </ClientDialog>
  )
}

function SourceDialog({
  item,
  onClose,
}: {
  item: IProfileItem
  onClose: () => void
}) {
  const client = useClient()
  const uid = item.uid!
  const query = useQuery({
    queryKey: ['desktop-profile-source', uid],
    queryFn: () => readProfileFile(uid),
    refetchOnWindowFocus: false,
  })
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? query.data ?? ''
  return (
    <ClientDialog
      title={`编辑配置 · ${item.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="q-btn q-primary"
            disabled={Boolean(client.busy) || query.data === undefined}
            onClick={() => {
              void client
                .perform(
                  'source-save',
                  async () => {
                    load(text)
                    const result = await mutate(
                      () => saveProfileFile(uid, text),
                      { id: `save-profile-file:${uid}`, errorNotice: false },
                    )
                    if (!result.value)
                      throw new Error('配置校验失败，修改未应用。')
                    await client.refreshAll()
                  },
                  '配置已保存',
                )
                .then((saved) => {
                  if (saved) onClose()
                })
            }}
          >
            保存配置
          </button>
        </>
      }
    >
      {item.type === 'remote' && (
        <p className="q-note">
          订阅更新会覆盖文件修改；自定义规则请在分流规则页添加。
        </p>
      )}
      {query.error && (
        <p className="q-error" role="alert">
          {String(query.error)}
        </p>
      )}
      <label className="q-field">
        YAML
        <textarea
          className="q-input q-source-editor"
          value={text}
          disabled={query.data === undefined}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {client.error && (
        <p className="q-error" role="alert">
          {client.error}
        </p>
      )}
    </ClientDialog>
  )
}

export function ProfilesPanel() {
  const client = useClient()
  const [dialog, setDialog] = useState<{
    kind: 'new' | 'edit' | 'delete' | 'source'
    item?: IProfileItem
  } | null>(null)
  const items =
    client.profiles?.items?.filter(
      (item) => item.uid && ['remote', 'local'].includes(item.type || ''),
    ) || []
  const activate = (item: IProfileItem) =>
    client.perform('profile-select', async () => {
      const result = await client.patchProfiles({ current: item.uid })
      if (result.status !== 'valid')
        throw new Error(
          result.status === 'invalid'
            ? result.message
            : '配置正在更新，请稍后重试。',
        )
      await client.refreshAll()
    })
  return (
    <>
      <PageHeading
        title="订阅"
        subtitle="一次使用一份配置。"
        action={
          <button
            type="button"
            className="q-btn q-primary"
            onClick={() => setDialog({ kind: 'new' })}
          >
            <AddOutlined />
            添加订阅
          </button>
        }
      />
      {items.length ? (
        <div className="q-stack">
          {items.map((item) => {
            const usage = usageDetails(item)
            const selected = client.current?.uid === item.uid
            return (
              <section
                className={`q-sub-card ${selected ? 'active' : ''}`}
                key={item.uid}
              >
                <div className="q-row">
                  <div className="q-inline">
                    <LayersOutlined />
                    <h2>{item.name || '未命名配置'}</h2>
                    {selected && <span className="q-pill blue">使用中</span>}
                  </div>
                  <button
                    type="button"
                    className="q-icon"
                    aria-label={`编辑 ${item.name}`}
                    onClick={() => setDialog({ kind: 'edit', item })}
                  >
                    <EditOutlined />
                  </button>
                </div>
                <p className="q-subtitle">
                  {item.type === 'remote' ? '远程订阅' : '本地配置'} ·{' '}
                  {item.updated
                    ? formatDate(item.updated) + ' 更新'
                    : '未提供更新时间'}
                </p>
                <div className="q-sub-usage">
                  {usage.ratio !== undefined && (
                    <div
                      className="q-progress"
                      role="progressbar"
                      aria-label="流量使用比例"
                      aria-valuenow={usage.ratio}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${usage.ratio}%` }} />
                    </div>
                  )}
                  <div className="q-usage-meta q-muted">
                    <span>{usage.label}</span>
                    <span>{usage.expire}</span>
                  </div>
                </div>
                <div className="q-sub-bottom">
                  {item.type === 'remote' ? (
                    <label className="q-toggle">
                      <input
                        type="checkbox"
                        aria-label={`${item.name} 自动更新`}
                        checked={Boolean(item.option?.allow_auto_update)}
                        disabled={Boolean(client.busy)}
                        onChange={(event) => {
                          const enabled = event.target.checked
                          void client.perform('auto-update', () =>
                            mutate(
                              () =>
                                patchProfile(item.uid!, {
                                  option: {
                                    ...item.option,
                                    allow_auto_update: enabled,
                                    update_interval:
                                      item.option?.update_interval || 1440,
                                  },
                                }),
                              {
                                id: `patch-profile:${item.uid}`,
                                errorNotice: false,
                                revalidate: [['getProfiles']],
                              },
                            ),
                          )
                        }}
                      />
                      <span>自动更新</span>
                    </label>
                  ) : (
                    <span className="q-muted">{item.file}</span>
                  )}
                  <div className="q-inline">
                    <button
                      type="button"
                      className="q-btn"
                      onClick={() => setDialog({ kind: 'source', item })}
                    >
                      编辑配置
                    </button>
                    {item.type === 'remote' && (
                      <button
                        type="button"
                        className="q-btn"
                        disabled={Boolean(client.busy)}
                        onClick={() => {
                          void client.perform('profile-update', () =>
                            mutate(() => updateProfile(item.uid!), {
                              id: `update-profile:${item.uid}`,
                              errorNotice: false,
                              revalidate: [['getProfiles']],
                            }),
                          )
                        }}
                      >
                        <RefreshOutlined />
                        更新
                      </button>
                    )}
                    {!selected && (
                      <button
                        type="button"
                        className="q-btn q-primary"
                        disabled={Boolean(client.busy)}
                        onClick={() => {
                          void activate(item)
                        }}
                      >
                        使用此{item.type === 'remote' ? '订阅' : '配置'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="q-link q-danger"
                      disabled={Boolean(client.busy)}
                      onClick={() => setDialog({ kind: 'delete', item })}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="暂无订阅"
          description="添加订阅链接或导入本地 YAML 配置。"
          action={
            <button
              type="button"
              className="q-btn"
              onClick={() => setDialog({ kind: 'new' })}
            >
              添加订阅
            </button>
          }
        />
      )}
      {dialog?.kind === 'new' && (
        <ProfileDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <ProfileDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'source' && dialog.item && (
        <SourceDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && dialog.item && (
        <ClientDialog
          title="删除订阅"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button
                type="button"
                className="q-btn"
                onClick={() => setDialog(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="q-btn q-primary"
                disabled={Boolean(client.busy)}
                onClick={() => {
                  const item = dialog.item!
                  void client
                    .perform(
                      'profile-delete',
                      async () => {
                        if (client.current?.uid === item.uid)
                          await client.patchVerge({
                            enable_system_proxy: false,
                            enable_tun_mode: false,
                          })
                        await mutate(() => deleteProfile(item.uid!), {
                          id: `delete-profile:${item.uid}`,
                          errorNotice: false,
                          revalidate: [
                            ['getProfiles'],
                            ['getVergeConfig'],
                            ['getSystemProxy'],
                            ['getAutoProxy'],
                          ],
                        })
                        await client.refreshAll()
                      },
                      '订阅已删除',
                    )
                    .then((deleted) => {
                      if (deleted) setDialog(null)
                    })
                }}
              >
                删除
              </button>
            </>
          }
        >
          <p className="q-muted">
            删除「{dialog.item.name}」？
            {client.current?.uid === dialog.item.uid
              ? '这是当前配置，连接会先断开。'
              : ''}
          </p>
        </ClientDialog>
      )}
    </>
  )
}
