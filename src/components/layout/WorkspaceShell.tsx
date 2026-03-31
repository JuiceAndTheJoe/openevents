import { ReactNode } from 'react'

type WorkspaceLayoutContainerProps = {
  sidebarTitle: string
  sidebarNav: ReactNode
  children: ReactNode
}

type WorkspaceAccessDeniedProps = {
  message: string
}

type WorkspacePageHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
}

export type WorkspaceStatItem = {
  label: string
  value: string | number
  subtitle?: string
}

type WorkspaceStatsGridProps = {
  items: WorkspaceStatItem[]
  columns?: 2 | 3 | 4
}

export function WorkspaceLayoutContainer({
  sidebarTitle,
  sidebarNav,
  children,
}: WorkspaceLayoutContainerProps) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:py-8 md:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4 md:sticky md:top-24">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{sidebarTitle}</h2>
        {sidebarNav}
      </aside>
      <div>{children}</div>
    </div>
  )
}

export function WorkspaceAccessDenied({ message }: WorkspaceAccessDeniedProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {message}
      </div>
    </div>
  )
}

export function WorkspacePageHeader({ title, description, actions }: WorkspacePageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

export function WorkspaceStatsGrid({ items, columns = 3 }: WorkspaceStatsGridProps) {
  const gridCols =
    columns === 2
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
      : columns === 4
        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
        : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={gridCols}>
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
          {item.subtitle && <p className="mt-1 text-xs text-gray-400">{item.subtitle}</p>}
        </div>
      ))}
    </div>
  )
}
