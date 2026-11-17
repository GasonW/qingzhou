import { type ReactNode } from 'react'

import { ClientContext, useClientState } from './client-context'

export function ClientProvider({ children }: { children: ReactNode }) {
  const value = useClientState()
  return <ClientContext value={value}>{children}</ClientContext>
}
