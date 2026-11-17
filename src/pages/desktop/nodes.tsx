import {
  AddOutlined,
  ChevronRightOutlined,
  InfoOutlined,
  SearchOutlined,
  SpeedOutlined,
  StarBorderOutlined,
  StarOutlined,
} from '@mui/icons-material'
import { useLocalStorage } from 'foxact/use-local-storage'
import { useEffect, useMemo, useState } from 'react'

import { useGroupDelays } from '@/hooks/use-group-delays'
import { useProxyDelayState } from '@/hooks/use-proxy-delay-state'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import delayManager from '@/services/delay'
import { showNotice } from '@/services/notice-service'
import {
  isInteractableMember,
  memberDetails,
  resolveMember,
  type ResolvedProxyMember,
} from '@/types/proxy-view'

import { useClient } from './client-context'
import { withOccurrenceKeys } from './list-keys'
import { ManualNodeDialog } from './profiles'
import { EmptyState, ModeTabs, PageHeading } from './ui'

function NodeRow({
  member,
  groupName,
  selected,
  favorite,
  onFavorite,
  onSelect,
  onOpenGroup,
}: {
  member: ResolvedProxyMember
  groupName: string
  selected: boolean
  favorite: boolean
  onFavorite: () => void
  onSelect: () => void
  onOpenGroup: () => void
}) {
  const { delayValue, isPreset, onDelay, timeout } = useProxyDelayState(
    member,
    groupName,
  )
  const details = memberDetails(member)
  return (
    <div className={`q-node-row ${selected ? 'selected' : ''}`}>
      <button
        type="button"
        className="q-node-select"
        aria-pressed={selected}
        disabled={member.kind === 'unresolved'}
        onClick={onSelect}
      >
        <span className="q-radio">{selected ? '✓' : ''}</span>
        <span>
          <span className="q-node-name">{member.ref.name}</span>
          <span className="q-node-meta">
            {member.kind === 'unresolved'
              ? '节点信息不可用'
              : member.kind === 'group'
                ? `代理组 · ${details?.type}`
                : details?.type}
          </span>
        </span>
      </button>
      {!isPreset && (
        <button
          type="button"
          className={`q-link q-delay ${delayValue > timeout ? 'failed' : ''}`}
          aria-label={`测试 ${member.ref.name} 延迟`}
          onClick={() => {
            void onDelay()
          }}
        >
          {delayValue === -2
            ? '检测中'
            : delayValue < 0
              ? '测速'
              : delayValue > timeout
                ? '超时'
                : `${delayValue} ms`}
        </button>
      )}
      {member.kind === 'group' && (
        <button
          type="button"
          className="q-icon"
          aria-label={`展开代理组 ${member.ref.name}`}
          onClick={onOpenGroup}
        >
          <ChevronRightOutlined />
        </button>
      )}
      <button
        type="button"
        className={`q-icon q-star ${favorite ? 'active' : ''}`}
        aria-pressed={favorite}
        aria-label={`${favorite ? '取消收藏' : '收藏'} ${member.ref.name}`}
        onClick={onFavorite}
      >
        {favorite ? <StarOutlined /> : <StarBorderOutlined />}
      </button>
    </div>
  )
}

export function NodePicker({ onSelected }: { onSelected?: () => void }) {
  const client = useClient()
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortByDelay, setSortByDelay] = useState(false)
  const [testing, setTesting] = useState(false)
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    'qingzhou-favorite-proxies',
    [],
    {
      serializer: JSON.stringify,
      deserializer: JSON.parse,
    },
  )
  const group = client.group
  const testUrl =
    group?.testUrl ||
    client.verge?.default_latency_test ||
    'https://www.gstatic.com/generate_204'
  useEffect(() => {
    if (group) delayManager.setUrl(group.name, testUrl)
  }, [group, testUrl])
  const delays = useGroupDelays(group?.name ?? null)
  const memberKey = (member: ResolvedProxyMember) =>
    `${client.current?.uid}:${group?.name}:${member.kind}:${member.kind === 'node' ? member.node.recordId : member.ref.name}`
  const members = useMemo(
    () =>
      client.proxyView && group
        ? group.members.map((member) =>
            resolveMember(client.proxyView!, member),
          )
        : [],
    [client.proxyView, group],
  )
  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => {
      void client.refreshProxy()
      onSelected?.()
    },
    onError: showNotice.error,
  })
  const filtered = members.filter(
    (member) =>
      member.ref.name.toLowerCase().includes(search.toLowerCase()) &&
      (!favoritesOnly || favorites.includes(memberKey(member))),
  )
  if (sortByDelay)
    filtered.sort((left, right) => {
      const a = delays.of(left),
        b = delays.of(right)
      return (a < 0 ? Infinity : a) - (b < 0 ? Infinity : b)
    })
  const testGroup = async () => {
    if (!group || testing) return
    setTesting(true)
    try {
      await delayManager.checkListDelay(
        members.filter(isInteractableMember),
        group.name,
        client.verge?.default_latency_timeout || 10000,
      )
    } catch (cause) {
      showNotice.error(cause)
    } finally {
      setTesting(false)
    }
  }
  return (
    <>
      {client.groups.length > 1 && (
        <label className="q-field">
          代理组
          <select
            value={group?.name ?? ''}
            onChange={(event) => client.setGroupName(event.target.value)}
          >
            {client.groups.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="q-toolbar">
        <label className="q-search">
          <SearchOutlined />
          <input
            type="search"
            placeholder="搜索节点"
            aria-label="搜索节点"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="q-btn"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          <StarBorderOutlined />
          收藏
        </button>
      </div>
      <div className="q-row q-node-toolbar">
        <span className="q-muted">
          {group?.name || '暂无代理组'} · {members.length} 个选项
        </span>
        <div className="q-inline">
          <button
            type="button"
            className="q-link"
            onClick={() => setSortByDelay(!sortByDelay)}
          >
            {sortByDelay ? '默认排序' : '按延迟排序'}
          </button>
          <button
            type="button"
            className="q-btn"
            disabled={testing || !members.length}
            onClick={() => {
              void testGroup()
            }}
          >
            <SpeedOutlined />
            {testing ? '检测中…' : '延迟测试'}
          </button>
        </div>
      </div>
      {client.isProxyViewPending ? (
        <EmptyState title="正在读取节点…" />
      ) : client.isProxyViewError ? (
        <EmptyState
          title="无法读取节点"
          action={
            <button
              type="button"
              className="q-btn"
              onClick={() => {
                void client.refreshProxy()
              }}
            >
              重试
            </button>
          }
        />
      ) : filtered.length && group ? (
        <div className="q-node-list">
          {withOccurrenceKeys(filtered, memberKey).map(
            ({ key, value: member }) => (
              <NodeRow
                key={key}
                member={member}
                groupName={group.name}
                selected={group.now === member.ref.name}
                favorite={favorites.includes(memberKey(member))}
                onSelect={() => {
                  if (isInteractableMember(member))
                    handleProxyGroupChange(group, { name: member.ref.name })
                }}
                onOpenGroup={() => client.setGroupName(member.ref.name)}
                onFavorite={() => {
                  const key = memberKey(member)
                  setFavorites(
                    favorites.includes(key)
                      ? favorites.filter((item) => item !== key)
                      : [...favorites, key],
                  )
                }}
              />
            ),
          )}
        </div>
      ) : (
        <EmptyState
          title={members.length ? '没有匹配的节点' : '暂无节点'}
          description={
            members.length
              ? '修改搜索内容或收藏筛选。'
              : '请导入订阅或添加节点配置。'
          }
        />
      )}
    </>
  )
}

export function NodesPanel() {
  const [manualOpen, setManualOpen] = useState(false)
  const client = useClient()
  return (
    <>
      <PageHeading
        title="节点"
        subtitle="点击节点即可切换。"
        action={
          <button
            type="button"
            className="q-btn"
            onClick={() => setManualOpen(true)}
          >
            <AddOutlined />
            手动添加
          </button>
        }
      />
      <ModeTabs />
      <NodePicker />
      <p className="q-note">
        <InfoOutlined />
        {client.mode === 'direct'
          ? '直连模式不使用代理节点。'
          : '代理组决定各类流量使用哪条线路；点击组右侧箭头可查看组内节点。'}
      </p>
      {manualOpen && <ManualNodeDialog onClose={() => setManualOpen(false)} />}
    </>
  )
}
