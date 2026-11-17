import {
  TimelineOutlined,
  DnsOutlined,
  HomeOutlined,
  LayersOutlined,
  SettingsOutlined,
  AltRouteOutlined,
  CloseOutlined,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router'

import qingzhouIcon from '@/assets/qingzhou.svg'
import { WindowControls } from '@/components/layout/window-controller'
import { useWindowDecorations } from '@/hooks/use-window'
import { openAppDir } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'

import { ActivityPanel } from './activity'
import { useClient } from './client-context'
import { ClientProvider } from './client-provider'
import { HomePanel } from './connection'
import { NodesPanel } from './nodes'
import { ProfilesPanel } from './profiles'
import { RulesPanel } from './rules'
import { SettingsPanel } from './settings'

import './desktop.scss'

const navigation = [
  { path: '/', title: '概览', Icon: HomeOutlined },
  { path: '/proxies', title: '节点', Icon: DnsOutlined },
  { path: '/profile', title: '订阅', Icon: LayersOutlined },
  { path: '/rules', title: '分流规则', Icon: AltRouteOutlined },
  { path: '/connections', title: '连接记录', Icon: TimelineOutlined },
  { path: '/settings', title: '设置', Icon: SettingsOutlined },
]

function DesktopShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const themeMode = useThemeMode()
  const client = useClient()
  const { decorated } = useWindowDecorations()
  const path = location.pathname
  const currentPath = path === '/logs' ? '/connections' : path
  return (
    <div id="verge-concept" className="qingzhou" data-appearance={themeMode}>
      <header className="q-titlebar" data-tauri-drag-region>
        <div className="q-brand" data-tauri-drag-region>
          <span className="q-mark">
            <img src={qingzhouIcon} alt="" />
          </span>
          <span data-tauri-drag-region>轻舟</span>
        </div>
        {decorated === false && <WindowControls />}
      </header>
      <div className="q-shell">
        <aside className="q-sidebar">
          <nav aria-label="主导航">
            {navigation.map(({ path: target, title, Icon }) => (
              <button
                type="button"
                className="q-navbtn"
                key={target}
                aria-current={currentPath === target ? 'page' : undefined}
                onClick={() => {
                  void navigate(target)
                }}
              >
                <Icon />
                {title}
              </button>
            ))}
          </nav>
          <div className="q-sidebar-bottom">
            <span className="q-dot" />
            {client.isLoading
              ? '正在读取状态'
              : client.runState.mode === 'NotRunning'
                ? '内核未运行'
                : client.connected
                  ? '网络已连接'
                  : '内核运行中'}
          </div>
        </aside>
        <main id="q-main">
          {client.error && (
            <div className="q-error q-row" role="alert">
              <span>{client.error}</span>
              <button
                type="button"
                className="q-icon"
                onClick={() => client.setError(null)}
                aria-label="关闭错误提示"
              >
                <CloseOutlined />
              </button>
            </div>
          )}
          {path === '/' && <HomePanel />}
          {path === '/proxies' && <NodesPanel />}
          {path === '/profile' && <ProfilesPanel />}
          {path === '/rules' && <RulesPanel key={client.current?.uid} />}
          {(path === '/connections' || path === '/logs') && (
            <ActivityPanel
              key={path}
              initialTab={path === '/logs' ? 'logs' : 'connections'}
            />
          )}
          {(path === '/settings' || path === '/unlock') && <SettingsPanel />}
        </main>
      </div>
      <footer className="q-footer">
        <span>基于 Clash Verge Rev 2.5.10 · Windows</span>
        <button
          type="button"
          className="q-link"
          onClick={() => {
            void openAppDir().catch(showNotice.error)
          }}
        >
          打开配置目录
        </button>
      </footer>
    </div>
  )
}

export default function DesktopClient() {
  return (
    <ClientProvider>
      <DesktopShell />
    </ClientProvider>
  )
}
