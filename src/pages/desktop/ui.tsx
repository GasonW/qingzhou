import { CloseOutlined } from '@mui/icons-material'
import { Dialog } from '@mui/material'
import { type ReactNode } from 'react'

import { modes, useClient, type ProxyMode } from './client-context'

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="q-pagehead">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="q-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ClientDialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog
      open
      disablePortal
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { className: 'q-native-dialog' } }}
    >
      <div className="q-dialoghead">
        <h2>{title}</h2>
        <button
          type="button"
          className="q-icon"
          aria-label="关闭"
          onClick={onClose}
        >
          <CloseOutlined />
        </button>
      </div>
      {children}
      {footer && <div className="q-dialogfoot">{footer}</div>}
    </Dialog>
  )
}

export function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <div className="q-settings-row">
      <div>
        <h3>{label}</h3>
        {description && <p>{description}</p>}
      </div>
      <label className="q-toggle">
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    </div>
  )
}

export function ModeTabs() {
  const { mode, setMode, busy } = useClient()
  return (
    <div className="q-tabs q-mode-tabs" role="group" aria-label="代理模式">
      {(Object.keys(modes) as ProxyMode[]).map((key) => (
        <button
          type="button"
          key={key}
          className="q-tab"
          aria-pressed={mode === key}
          disabled={Boolean(busy)}
          onClick={() => {
            void setMode(key)
          }}
        >
          {modes[key].name}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="q-empty">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
