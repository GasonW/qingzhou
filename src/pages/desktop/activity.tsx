import { CloseOutlined, SearchOutlined } from '@mui/icons-material'
import { useState } from 'react'
import { closeAllConnections, closeConnection } from 'tauri-plugin-mihomo-api'

import { useClashLog } from '@/hooks/use-clash-log'
import { useConnectionData } from '@/hooks/use-connection-data'
import { useLogData } from '@/hooks/use-log-data'
import { mutate } from '@/services/mutate'

import { useClient } from './client-context'
import { formatBytes } from './format'
import { withOccurrenceKeys } from './list-keys'
import { ClientDialog, EmptyState, PageHeading, Toggle } from './ui'

function ConnectionList() {
  const client = useClient()
  const { response, clearClosedConnections } = useConnectionData()
  const [closed, setClosed] = useState(false)
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [detail, setDetail] = useState<IConnectionsItem | null>(null)
  const connections = closed
    ? response.data.closedConnections
    : response.data.activeConnections
  const filtered = connections.filter((item) =>
    `${item.metadata.host} ${item.metadata.destinationIP} ${item.metadata.process} ${item.rule} ${item.chains.join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const maxPage = Math.max(0, Math.ceil(filtered.length / 100) - 1)
  const page = Math.min(pageIndex, maxPage)
  const items = filtered.slice(page * 100, (page + 1) * 100)
  const target = (item: IConnectionsItem) =>
    item.metadata.host ||
    item.metadata.remoteDestination ||
    item.metadata.destinationIP ||
    '未知目标'
  const closeOne = (id: string) =>
    client.perform('connection-close', () =>
      mutate(() => closeConnection(id), {
        id: `close-connection:${id}`,
        errorNotice: false,
      }),
    )
  return (
    <>
      <div className="q-toolbar">
        <div className="q-tabs">
          <button
            type="button"
            className="q-tab"
            aria-pressed={!closed}
            onClick={() => {
              setClosed(false)
              setPageIndex(0)
            }}
          >
            实时连接 · {response.data.activeConnections.length}
          </button>
          <button
            type="button"
            className="q-tab"
            aria-pressed={closed}
            onClick={() => {
              setClosed(true)
              setPageIndex(0)
            }}
          >
            已关闭 · {response.data.closedConnections.length}
          </button>
        </div>
        <button
          type="button"
          className="q-btn"
          disabled={Boolean(client.busy)}
          onClick={() => {
            if (closed) clearClosedConnections()
            else
              void client.perform('connections-close-all', () =>
                mutate(closeAllConnections, {
                  id: 'close-all-connections',
                  errorNotice: false,
                }),
              )
          }}
        >
          {closed ? '清空历史显示' : '关闭全部连接'}
        </button>
      </div>
      <label className="q-search">
        <SearchOutlined />
        <input
          type="search"
          value={search}
          placeholder="搜索域名、应用或规则"
          aria-label="搜索连接"
          onChange={(event) => {
            setSearch(event.target.value)
            setPageIndex(0)
          }}
        />
      </label>
      {items.length ? (
        <>
          <table className="q-table">
            <thead>
              <tr>
                <th>目标 / 应用</th>
                <th>去向</th>
                <th>下载</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="q-link"
                      onClick={() => setDetail(item)}
                    >
                      {target(item)}
                    </button>
                    <span className="q-node-meta">
                      {item.metadata.process ||
                        item.metadata.processPath ||
                        '未知应用'}
                    </span>
                  </td>
                  <td>
                    <span className="q-pill">{item.chains[0] || '—'}</span>
                  </td>
                  <td>{formatBytes(item.download)}</td>
                  <td>
                    {!closed && (
                      <button
                        type="button"
                        className="q-icon"
                        aria-label={`关闭 ${target(item)}`}
                        disabled={Boolean(client.busy)}
                        onClick={() => {
                          void closeOne(item.id)
                        }}
                      >
                        <CloseOutlined />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="q-list-footer">
            <span>
              共 {filtered.length} 条 · 第 {page + 1} / {maxPage + 1} 页
            </span>
            <div className="q-inline">
              <button
                type="button"
                className="q-btn"
                disabled={page === 0}
                onClick={() => setPageIndex(page - 1)}
              >
                上一页
              </button>
              <button
                type="button"
                className="q-btn"
                disabled={page === maxPage}
                onClick={() => setPageIndex(page + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={
            search
              ? '没有匹配的连接'
              : closed
                ? '暂无已关闭连接'
                : '暂无活跃连接'
          }
          description="连接记录由代理内核实时提供。"
        />
      )}
      {detail && (
        <ClientDialog
          title="连接详情"
          onClose={() => setDetail(null)}
          footer={
            !closed && (
              <button
                type="button"
                className="q-btn q-danger"
                disabled={Boolean(client.busy)}
                onClick={() => {
                  void closeOne(detail.id).then((done) => {
                    if (done) setDetail(null)
                  })
                }}
              >
                关闭此连接
              </button>
            )
          }
        >
          {[
            ['目标', target(detail)],
            [
              '应用',
              detail.metadata.processPath ||
                detail.metadata.process ||
                '未提供',
            ],
            [
              '目标地址',
              `${detail.metadata.destinationIP}:${detail.metadata.destinationPort}`,
            ],
            [
              '来源地址',
              `${detail.metadata.sourceIP}:${detail.metadata.sourcePort}`,
            ],
            ['网络协议', detail.metadata.network],
            ['命中规则', `${detail.rule} ${detail.rulePayload}`],
            ['代理链路', [...detail.chains].reverse().join(' → ')],
            [
              '上传 / 下载',
              `${formatBytes(detail.upload)} / ${formatBytes(detail.download)}`,
            ],
            ['开始时间', new Date(detail.start).toLocaleString('zh-CN')],
          ].map(([label, value]) => (
            <div className="q-detail" key={label}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </ClientDialog>
      )}
    </>
  )
}

function LogList() {
  const [preferences, setPreferences] = useClashLog()
  const { response, refreshGetClashLog } = useLogData()
  const [search, setSearch] = useState('')
  const logs = (response.data || []).filter((item) =>
    `${item.type} ${item.payload}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <>
      <Toggle
        label="记录日志"
        description="开启后显示内核运行日志；清空显示不会删除磁盘日志。"
        checked={preferences.enable}
        onChange={(enabled) =>
          setPreferences({ ...preferences, enable: enabled })
        }
      />
      <div className="q-toolbar">
        <label className="q-search">
          <SearchOutlined />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索日志"
            aria-label="搜索日志"
          />
        </label>
        <select
          value={preferences.logLevel}
          aria-label="日志级别"
          onChange={(event) =>
            setPreferences({
              ...preferences,
              logLevel: event.target.value as typeof preferences.logLevel,
            })
          }
        >
          {['DEBUG', 'INFO', 'WARNING', 'ERROR', 'SILENT'].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="q-btn"
          onClick={() => refreshGetClashLog(true)}
        >
          清空显示
        </button>
      </div>
      <p className="q-muted">
        显示最近 {Math.min(200, logs.length)} 条匹配日志
      </p>
      {logs.length ? (
        withOccurrenceKeys(
          logs.slice(-200).reverse(),
          (item) => `${item.time}:${item.type}:${item.payload}`,
        ).map(({ key, value: item }) => (
          <div className="q-log" key={key}>
            <time>{item.time}</time>
            <span className={item.type === 'error' ? 'q-danger' : 'q-muted'}>
              {item.type}
            </span>
            <span>{item.payload}</span>
          </div>
        ))
      ) : (
        <EmptyState
          title={preferences.enable ? '暂无匹配日志' : '日志记录已关闭'}
        />
      )}
    </>
  )
}

export function ActivityPanel({
  initialTab,
}: {
  initialTab: 'connections' | 'logs'
}) {
  const [tab, setTab] = useState(initialTab)
  return (
    <>
      <PageHeading title="连接记录" />
      <div className="q-tabs q-activity-tabs">
        <button
          type="button"
          className="q-tab"
          aria-pressed={tab === 'connections'}
          onClick={() => setTab('connections')}
        >
          连接
        </button>
        <button
          type="button"
          className="q-tab"
          aria-pressed={tab === 'logs'}
          onClick={() => setTab('logs')}
        >
          运行日志
        </button>
      </div>
      {tab === 'connections' ? <ConnectionList /> : <LogList />}
    </>
  )
}
