import { useLocalStorage } from 'foxact/use-local-storage'
import { createContext, use, useState } from 'react'

import { useClash, useClashMode } from '@/hooks/use-clash'
import { useProfiles } from '@/hooks/use-profiles'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { patchClashMode, restartCore } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { errorDetail, showNotice } from '@/services/notice-service'
import { revalidateQueries } from '@/services/query-client'
import { requestService } from '@/services/service-request'

export const modes = {
  rule: {
    name: '规则分流',
    description: '按配置文件和自定义规则决定直连、代理或拦截',
  },
  global: {
    name: '全局代理',
    description: '统一通过当前代理节点访问，不按规则区分',
  },
  direct: { name: '全部直连', description: '直接访问目标网站，不使用代理节点' },
} as const

export type ProxyMode = keyof typeof modes
type AccessPreference = { system: boolean; tun: boolean }

export function useClientState() {
  const { verge, patchVerge } = useVerge()
  const { clash, patchClash, version } = useClash()
  const profileState = useProfiles()
  const proxyState = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const refreshers = useAppRefreshers()
  const systemState = useSystemState()
  const systemProxy = useSystemProxyState()
  const fallbackMode = useClashMode(!clashConfig?.mode)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [groupNames, setGroupNames] = useLocalStorage<
    Partial<Record<ProxyMode, string>>
  >(
    'qingzhou-proxy-groups',
    {},
    {
      serializer: JSON.stringify,
      deserializer: JSON.parse,
    },
  )
  const [access, setAccess] = useLocalStorage<AccessPreference>(
    'qingzhou-access-preference',
    { system: true, tun: false },
    { serializer: JSON.stringify, deserializer: JSON.parse },
  )
  const rawMode = (
    clashConfig?.mode ??
    fallbackMode.data ??
    clash?.mode
  )?.toLowerCase()
  const mode = rawMode && rawMode in modes ? (rawMode as ProxyMode) : undefined
  const view = proxyState.proxyView
  const groups = view
    ? [
        ...(view.global ? [view.global] : []),
        ...view.groups.filter((group) => !group.hidden),
      ]
    : []
  const setGroupName = (name: string) =>
    setGroupNames({ ...groupNames, [mode ?? 'rule']: name })
  const group =
    groups.find((item) => item.name === groupNames[mode ?? 'rule']) ??
    (mode === 'global'
      ? view?.global
      : view?.groups.find((item) => !item.hidden)) ??
    view?.global ??
    undefined
  const connected =
    systemProxy.indicator ||
    Boolean(
      verge?.enable_tun_mode &&
        systemState.isTunModeAvailable &&
        systemState.runState.mode !== 'NotRunning',
    )

  const perform = async (
    label: string,
    operation: () => Promise<unknown>,
    success?: string,
  ) => {
    setBusy(label)
    setError(null)
    try {
      await operation()
      if (success) showNotice.success(success)
      return true
    } catch (cause) {
      const message = errorDetail(cause)
      setError(message)
      showNotice.error(cause)
      return false
    } finally {
      setBusy(null)
    }
  }

  const setMode = (next: ProxyMode) =>
    perform('mode', async () => {
      const result = await mutate(() => patchClashMode(next), {
        id: 'patch-clash-mode',
        errorNotice: false,
      })
      if (!result.ok) throw new Error('配置正在更新，请稍后重试。')
      await Promise.all([
        refreshers.refreshClashConfig(),
        revalidateQueries([['getRuntimeConfig'], ['getClashMode']]),
      ])
    })

  const toggleConnection = async () => {
    if (!connected && !profileState.current) {
      setError('请先导入订阅或添加节点。')
      return
    }
    if (!connected && access.tun && !systemState.isTunModeAvailable) {
      requestService({
        reason: 'tunNeedsService',
        restore: { enable_tun_mode: true },
      })
      return
    }
    await perform('connection', async () => {
      if (connected) {
        setAccess({
          system: systemProxy.indicator,
          tun: Boolean(verge?.enable_tun_mode),
        })
        await patchVerge({ enable_system_proxy: false, enable_tun_mode: false })
      } else {
        if (systemState.runState.mode === 'NotRunning') {
          await mutate(restartCore, { id: 'restart-core', errorNotice: false })
          await systemState.mutateSystemState()
        }
        await patchVerge({
          enable_system_proxy: access.system || !access.tun,
          enable_tun_mode: access.tun,
        })
      }
      await revalidateQueries([['getSystemProxy'], ['getAutoProxy']])
    })
  }

  const setSystemProxy = (enabled: boolean) =>
    perform('system-proxy', async () => {
      if (enabled && systemState.runState.mode === 'NotRunning') {
        throw new Error('代理内核未运行，请先重启内核。')
      }
      await systemProxy.toggleSystemProxy(enabled)
      if (enabled)
        setAccess({ system: true, tun: Boolean(verge?.enable_tun_mode) })
    })

  const setTun = async (enabled: boolean) => {
    if (enabled && !systemState.isTunModeAvailable) {
      requestService({
        reason: 'tunNeedsService',
        restore: { enable_tun_mode: true },
      })
      return
    }
    await perform('tun', async () => {
      await patchVerge({ enable_tun_mode: enabled })
      if (enabled) setAccess({ system: systemProxy.indicator, tun: true })
    })
  }

  return {
    verge,
    patchVerge,
    clash,
    patchClash,
    version,
    ...profileState,
    ...proxyState,
    ...systemState,
    ...refreshers,
    mode,
    groups,
    group,
    setGroupName,
    connected,
    systemProxyEnabled: systemProxy.indicator,
    busy,
    error,
    setError,
    perform,
    setMode,
    toggleConnection,
    setSystemProxy,
    setTun,
  }
}

export const ClientContext = createContext<ReturnType<
  typeof useClientState
> | null>(null)

export function useClient() {
  const value = use(ClientContext)
  if (!value) throw new Error('Desktop client context is unavailable')
  return value
}
