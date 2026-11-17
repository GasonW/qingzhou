import {
  ChevronRightOutlined,
  ExpandMoreOutlined,
  InfoOutlined,
  PowerSettingsNewOutlined,
  ShieldOutlined,
  SpeedOutlined,
} from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useAppUptime } from '@/hooks/use-system-state'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { exportDiagnosticInfo } from '@/services/cmds'
import { mutate } from '@/services/mutate'

import { modes, useClient, type ProxyMode } from './client-context'
import { formatBytes } from './format'
import { NodePicker } from './nodes'
import { profileUsageLabel } from './profile-usage'
import { ClientDialog, PageHeading, Toggle } from './ui'

export function NetworkAccess() {
  const client = useClient()
  return (
    <>
      <Toggle
        label="系统代理"
        description="让遵循系统代理设置的应用使用代理，例如多数浏览器。忽略此设置的应用不受影响。"
        checked={client.systemProxyEnabled}
        disabled={Boolean(client.busy)}
        onChange={(enabled) => {
          void client.setSystemProxy(enabled)
        }}
      />
      <Toggle
        label="TUN（虚拟网卡）"
        description="让不使用系统代理的应用，也能通过代理访问，例如部分游戏和命令行工具。"
        checked={Boolean(
          client.verge?.enable_tun_mode && client.isTunModeAvailable,
        )}
        disabled={Boolean(client.busy)}
        onChange={(enabled) => {
          void client.setTun(enabled)
        }}
      />
      <div className="q-tun-help">
        <p>
          <b>何时开启：</b>
          浏览器可以访问，但其他应用无法访问时，可尝试开启。一般可先只开系统代理。
        </p>
        <p>
          <b>开启影响：</b>
          通过虚拟网卡接管更多应用的网络请求，仍按所选模式和规则处理，不等于全局代理。
        </p>
        <p>
          <b>关闭影响：</b>
          停止虚拟网卡接管；系统代理若仍开启，支持它的应用会继续使用代理。
        </p>
        <p>
          <b>权限与兼容：</b>
          {client.isTunModeAvailable
            ? '当前已具备 TUN 所需权限。'
            : '首次启用需要安装后台服务或以管理员身份运行。'}
          与其他 VPN 同时开启可能冲突，网络异常时可先关闭 TUN。
        </p>
      </div>
    </>
  )
}

function ModeDialog({ onClose }: { onClose: () => void }) {
  const client = useClient()
  const [draft, setDraft] = useState<ProxyMode>(client.mode ?? 'rule')
  return (
    <ClientDialog
      title="选择代理模式"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="q-btn q-primary"
            disabled={Boolean(client.busy)}
            onClick={() => {
              void client.setMode(draft).then((applied) => {
                if (applied) onClose()
              })
            }}
          >
            {client.busy === 'mode' ? '应用中…' : '应用模式'}
          </button>
        </>
      }
    >
      {(Object.keys(modes) as ProxyMode[]).map((mode) => (
        <button
          type="button"
          key={mode}
          className="q-modechoice"
          aria-pressed={draft === mode}
          onClick={() => setDraft(mode)}
        >
          <span className="q-radio">{draft === mode ? '✓' : ''}</span>
          <span>
            <b>{modes[mode].name}</b>
            <small>{modes[mode].description}</small>
          </span>
        </button>
      ))}
      <p className="q-note">
        <InfoOutlined />
        生效范围由系统代理或 TUN 的设置决定。
      </p>
    </ClientDialog>
  )
}

function DiagnosticDialog({ onClose }: { onClose: () => void }) {
  const client = useClient()
  return (
    <ClientDialog
      title="网络诊断"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="q-btn" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="q-btn q-primary"
            disabled={Boolean(client.busy)}
            onClick={() => {
              void client.perform('diagnostic-export', () =>
                mutate(exportDiagnosticInfo, {
                  id: 'export-diagnostic-info',
                  errorNotice: false,
                }),
              )
            }}
          >
            导出诊断信息
          </button>
        </>
      }
    >
      <div className="q-detail">
        <span>代理内核</span>
        <span>
          {client.runState.mode === 'NotRunning' ? '未运行' : client.version}
        </span>
      </div>
      <div className="q-detail">
        <span>系统代理</span>
        <span>{client.systemProxyEnabled ? '已启用' : '未启用'}</span>
      </div>
      <div className="q-detail">
        <span>TUN 模式</span>
        <span>
          {client.verge?.enable_tun_mode && client.isTunModeAvailable
            ? '已启用'
            : '未启用'}
        </span>
      </div>
      <div className="q-detail">
        <span>后台服务</span>
        <span>
          {client.runState.serviceUsable
            ? '可用'
            : client.runState.serviceUnavailableReason || '未就绪'}
        </span>
      </div>
      <div className="q-detail">
        <span>当前配置</span>
        <span>{client.current?.file || '未选择'}</span>
      </div>
      <div className="q-detail">
        <span>当前节点</span>
        <span>{client.group?.now || '未选择'}</span>
      </div>
      <p className="q-note">
        <InfoOutlined />
        节点是否可用，请到节点页运行延迟测试。诊断信息可能包含网络地址，分享前请检查。
      </p>
    </ClientDialog>
  )
}

export function HomePanel() {
  const client = useClient()
  const navigate = useNavigate()
  const displayedGroup =
    client.mode === 'global' ? client.proxyView?.global : client.group
  const { response } = useTrafficData()
  const uptime = useAppUptime()
  const [dialog, setDialog] = useState<
    'mode' | 'nodes' | 'access' | 'diagnose' | null
  >(null)
  const traffic = response.data
  const runningSeconds = Math.floor(uptime / 1000)
  const clock = [
    Math.floor(runningSeconds / 3600),
    Math.floor(runningSeconds / 60) % 60,
    runningSeconds % 60,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
  return (
    <>
      <PageHeading
        title="概览"
        action={
          <button
            type="button"
            className="q-link"
            onClick={() => setDialog('diagnose')}
          >
            网络诊断 <SpeedOutlined />
          </button>
        }
      />
      <section className="q-connect">
        <div className="q-row">
          <div className="q-status-line">
            <span className={`q-statusicon ${client.connected ? 'on' : ''}`}>
              {client.connected ? (
                <ShieldOutlined />
              ) : (
                <PowerSettingsNewOutlined />
              )}
            </span>
            <div>
              <h2>连接</h2>
              <p className="q-subtitle">
                {client.busy === 'connection'
                  ? '正在更新连接…'
                  : client.connected
                    ? `已连接 · ${client.mode ? modes[client.mode].name : '正在读取模式'}`
                    : '未连接'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="q-power"
            role="switch"
            aria-checked={client.connected}
            aria-label={client.connected ? '断开连接' : '开始连接'}
            disabled={Boolean(client.busy) || client.runState.opInFlight}
            onClick={() => {
              void client.toggleConnection()
            }}
          />
        </div>
        <div className="q-divider" />
        <div className="q-connect-actions">
          <button
            type="button"
            className="q-settingpick"
            onClick={() => setDialog('mode')}
          >
            <span>
              <small>代理模式</small>
              <b>{client.mode ? modes[client.mode].name : '正在读取…'}</b>
            </span>
            <ExpandMoreOutlined />
          </button>
          <button
            type="button"
            className="q-settingpick"
            onClick={() => {
              if (displayedGroup) client.setGroupName(displayedGroup.name)
              setDialog('nodes')
            }}
          >
            <span>
              <small>
                {client.mode === 'direct'
                  ? '节点 · 直连时不使用'
                  : displayedGroup?.name || '当前节点'}
              </small>
              <b>{displayedGroup?.now || '选择节点'}</b>
            </span>
            <ChevronRightOutlined />
          </button>
        </div>
        <div className="q-metrics">
          <div>
            <small>↓ 下载速率</small>
            <strong>
              {formatBytes(traffic?.down ?? 0)}
              <em>/s</em>
            </strong>
          </div>
          <div>
            <small>↑ 上传速率</small>
            <strong>
              {formatBytes(traffic?.up ?? 0)}
              <em>/s</em>
            </strong>
          </div>
          <div>
            <small>客户端运行时长</small>
            <strong>{clock}</strong>
          </div>
        </div>
      </section>
      <div className="q-homegrid">
        <section className="q-box">
          <div className="q-boxhead">
            <h2>当前配置</h2>
            <button
              type="button"
              className="q-link"
              onClick={() => {
                void navigate('/profile')
              }}
            >
              管理订阅 <ChevronRightOutlined />
            </button>
          </div>
          <h3>{client.current?.name || '未选择配置'}</h3>
          <p className="q-subtitle">
            {client.current?.file || '请导入订阅链接或 YAML 配置文件'}
          </p>
          {client.current && (
            <p className="q-note">{profileUsageLabel(client.current)}</p>
          )}
          <button
            type="button"
            className="q-mini-node"
            onClick={() => {
              void navigate('/proxies')
            }}
          >
            <span>{displayedGroup?.name || '节点'}</span>
            <span className="q-node-meta">
              {displayedGroup?.now || '查看节点'}
            </span>
            <ChevronRightOutlined />
          </button>
        </section>
        <section className="q-box">
          <h2>快捷设置</h2>
          <button
            type="button"
            className="q-tool"
            onClick={() => setDialog('mode')}
          >
            <span>
              <b>代理模式</b>
              <small>
                {client.mode ? modes[client.mode].name : '正在读取'}
              </small>
            </span>
            <ChevronRightOutlined />
          </button>
          <button
            type="button"
            className="q-tool"
            onClick={() => setDialog('access')}
          >
            <span>
              <b>连接方式</b>
              <small>
                {[
                  client.systemProxyEnabled ? '系统代理' : '',
                  client.verge?.enable_tun_mode ? 'TUN' : '',
                ]
                  .filter(Boolean)
                  .join(' + ') || '未启用'}
              </small>
            </span>
            <ChevronRightOutlined />
          </button>
          <button
            type="button"
            className="q-tool"
            onClick={() => {
              void navigate('/connections')
            }}
          >
            <span>
              <b>连接记录</b>
              <small>查看访问去向与运行日志</small>
            </span>
            <ChevronRightOutlined />
          </button>
        </section>
      </div>
      {dialog === 'mode' && <ModeDialog onClose={() => setDialog(null)} />}
      {dialog === 'nodes' && (
        <ClientDialog title="选择节点" onClose={() => setDialog(null)}>
          <NodePicker onSelected={() => setDialog(null)} />
        </ClientDialog>
      )}
      {dialog === 'access' && (
        <ClientDialog title="连接方式" onClose={() => setDialog(null)}>
          <NetworkAccess />
        </ClientDialog>
      )}
      {dialog === 'diagnose' && (
        <DiagnosticDialog onClose={() => setDialog(null)} />
      )}
    </>
  )
}
