import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        'inline-flex gap-1 rounded-card-sm bg-bg-1 p-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-button rounded-button px-4 text-body font-medium transition-all duration-tap',
              isActive
                ? 'bg-accent text-bg-0'
                : 'text-text-1 hover:bg-bg-2 hover:text-text-0'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
