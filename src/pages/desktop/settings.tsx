import { RestartAltOutlined } from '@mui/icons-material'
import { useRef, useState } from 'react'

import { type DialogRef } from '@/components/base'
import { ClashPortViewer } from '@/components/setting/mods/clash-port-viewer'
import { DnsViewer } from '@/components/setting/mods/dns-viewer'
import { useDisplayedMixedPort } from '@/hooks/use-displayed-mixed-port'
import { restartCore, setDnsOverride } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { revalidateQueries } from '@/services/query-client'

import { useClient } from './client-context'
import { NetworkAccess } from './connection'
import { ClientDialog, PageHeading, Toggle } from './ui'

function NetworkSettings() {
  const client = useClient()
  const portRef = useRef<DialogRef>(null)
  const dnsRef = useRef<DialogRef>(null)
  const port = useDisplayedMixedPort()
  const [confirmation, setConfirmation] = useState<{
    uid: string
    source: string
  } | null>(null)
  const uid = client.current?.uid
  const dnsEnabled = uid
    ? (client.verge?.profile_dns_settings?.[uid]?.enabled ??
      client.verge?.enable_dns_settings ??
      false)
    : false
  const applyDns = async (
    enabled: boolean,
    source?: string,
    profileUid = uid,
  ) => {
    if (!profileUid) return
    await client.perform('dns-override', async () => {
      const result = await mutate(
        () => setDnsOverride(profileUid, enabled, source),
        { id: 'set-dns-override', errorNotice: false },
      )
      if (!result.ok) throw new Error('配置正在更新，请稍后重试。')
      if (result.value.status === 'confirmation_required') {
        setConfirmation({ uid: profileUid, source: result.value.source })
      } else {
        setConfirmation(null)
        await revalidateQueries([['getVergeConfig'], ['getRuntimeConfig']])
      }
    })
  }
  return (
    <>
      <NetworkAccess />
      <Toggle
        label="代理守卫"
        description="连接期间，如果其他软件修改系统代理，自动恢复为本客户端。"
        checked={Boolean(client.verge?.enable_proxy_guard)}
        disabled={Boolean(client.busy)}
        onChange={(value) => {
          void client.perform('proxy-guard', () =>
            client.patchVerge({ enable_proxy_guard: value }),
          )
        }}
      />
      <Toggle
        label="允许局域网连接"
        description="同一网络的设备可手动填写本机 IP 和代理端口，使用本机代理。"
        checked={Boolean(client.clash?.['allow-lan'])}
        disabled={Boolean(client.busy)}
        onChange={(value) => {
          void client.perform('allow-lan', () =>
            client.patchClash({ 'allow-lan': value }),
          )
        }}
      />
      <Toggle
        label="IPv6"
        description="允许域名解析返回 IPv6 地址；需要网络支持 IPv6。"
        checked={Boolean(client.clash?.ipv6)}
        disabled={Boolean(client.busy)}
        onChange={(value) => {
          void client.perform('ipv6', () => client.patchClash({ ipv6: value }))
        }}
      />
      <div className="q-settings-row">
        <div>
          <h3>代理端口</h3>
          <p>混合代理端口：{port}</p>
        </div>
        <button
          type="button"
          className="q-btn"
          onClick={() => portRef.current?.open()}
        >
          配置端口
        </button>
      </div>
      <Toggle
        label="自定义 DNS"
        description="为当前配置使用客户端 DNS 设置。关闭后沿用配置文件中的 DNS。"
        checked={dnsEnabled}
        disabled={!uid || Boolean(client.busy)}
        onChange={(enabled) => {
          void applyDns(enabled)
        }}
      />
      <div className="q-settings-row">
        <div>
          <h3>DNS 设置</h3>
          <p>修改域名解析服务器和解析模式。</p>
        </div>
        <button
          type="button"
          className="q-btn"
          disabled={!uid}
          onClick={() => dnsRef.current?.open()}
        >
          配置 DNS
        </button>
      </div>
      <ClashPortViewer ref={portRef} />
      <DnsViewer ref={dnsRef} />
      {confirmation && (
        <ClientDialog
          title="启用自定义 DNS"
          onClose={() => setConfirmation(null)}
          footer={
            <>
              <button
                type="button"
                className="q-btn"
                onClick={() => setConfirmation(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="q-btn q-primary"
                disabled={Boolean(client.busy)}
                onClick={() => {
                  void applyDns(true, confirmation.source, confirmation.uid)
                }}
              >
                继续启用
              </button>
            </>
          }
        >
          <p className="q-muted">
            当前配置的 DNS 来自「{confirmation.source}」。启用后将使用客户端 DNS
            设置，可能改变域名解析结果。是否继续？
          </p>
        </ClientDialog>
      )}
    </>
  )
}

export function SettingsPanel() {
  const client = useClient()
  const [tab, setTab] = useState<'general' | 'network' | 'about'>('general')
  return (
    <>
      <PageHeading title="设置" />
      <div className="q-settings-nav q-tabs">
        {(['general', 'network', 'about'] as const).map((value) => (
          <button
            type="button"
            className="q-tab"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {{ general: '通用', network: '网络', about: '关于' }[value]}
          </button>
        ))}
      </div>
      <section className="q-box">
        {tab === 'general' && (
          <>
            <Toggle
              label="开机启动"
              description="登录电脑时自动启动。"
              checked={Boolean(client.verge?.enable_auto_launch)}
              disabled={Boolean(client.busy)}
              onChange={(enabled) => {
                void client.perform('auto-launch', () =>
                  client.patchVerge({ enable_auto_launch: enabled }),
                )
              }}
            />
            <Toggle
              label="启动时隐藏主窗口"
              description="启动后在系统托盘运行。"
              checked={Boolean(client.verge?.enable_silent_start)}
              disabled={Boolean(client.busy)}
              onChange={(enabled) => {
                void client.perform('silent-start', () =>
                  client.patchVerge({ enable_silent_start: enabled }),
                )
              }}
            />
            <Toggle
              label="切换节点时关闭旧连接"
              description="让已有请求重新建立连接，使用新选择的线路。"
              checked={Boolean(client.verge?.auto_close_connection)}
              disabled={Boolean(client.busy)}
              onChange={(enabled) => {
                void client.perform('close-old-connections', () =>
                  client.patchVerge({ auto_close_connection: enabled }),
                )
              }}
            />
            <div className="q-settings-row">
              <div>
                <h3>外观</h3>
                <p>浅色、深色或跟随系统</p>
              </div>
              <select
                value={client.verge?.theme_mode || 'system'}
                aria-label="外观"
                disabled={Boolean(client.busy)}
                onChange={(event) => {
                  const theme = event.target.value
                  void client.perform('appearance', () =>
                    client.patchVerge({ theme_mode: theme }),
                  )
                }}
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
            <p className="q-note">
              系统代理和 TUN 的启用状态会保存到配置，启动时按已保存的设置恢复。
            </p>
          </>
        )}
        {tab === 'network' && <NetworkSettings />}
        {tab === 'about' && (
          <>
            <h2>轻舟</h2>
            <p className="q-subtitle">基于 Clash Verge Rev 2.5.10 · Windows</p>
            <div className="q-detail">
              <span>代理内核</span>
              <span>{client.version}</span>
            </div>
            <div className="q-detail">
              <span>运行方式</span>
              <span>
                {client.runState.mode === 'Service'
                  ? '后台服务'
                  : client.runState.mode === 'Sidecar'
                    ? '子进程'
                    : '未运行'}
              </span>
            </div>
            <div className="q-detail">
              <span>许可证</span>
              <span>GPL-3.0-only</span>
            </div>
            <div className="q-settings-row">
              <div>
                <h3>重启代理内核</h3>
                <p>当前连接会短暂中断。</p>
              </div>
              <button
                type="button"
                className="q-btn"
                disabled={Boolean(client.busy) || client.runState.opInFlight}
                onClick={() => {
                  void client.perform('core-restart', async () => {
                    await mutate(restartCore, {
                      id: 'restart-core',
                      errorNotice: false,
                    })
                    await client.mutateSystemState()
                    await client.refreshAll()
                  })
                }}
              >
                <RestartAltOutlined />
                重启
              </button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
