'use client'

import { cn } from '@/lib/utils'

interface WizardStepProps {
  step: number
  title: string
  summary?: string
  isActive: boolean
  isComplete: boolean
  optional?: boolean
  onExpand: () => void
  children: React.ReactNode
}

export function WizardStep({
  step,
  title,
  summary,
  isActive,
  isComplete,
  optional,
  onExpand,
  children,
}: WizardStepProps) {
  const isCollapsed = !isActive

  return (
    <div
      className={cn(
        'rounded-card border transition-all duration-300',
        isActive
          ? 'border-accent bg-bg-1 shadow-sm shadow-accent/10'
          : isComplete
            ? 'border-stroke bg-bg-1 cursor-pointer hover:border-accent/50'
            : 'border-stroke/50 bg-bg-1/60'
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={isCollapsed && isComplete ? onExpand : undefined}
        disabled={!isCollapsed || !isComplete}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left min-h-[48px]',
          isCollapsed && isComplete && 'active:scale-[0.995] transition-transform'
        )}
      >
        {/* Step indicator */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
            isComplete
              ? 'bg-good text-bg-0'
              : isActive
                ? 'bg-accent text-bg-0'
                : 'bg-bg-2 text-text-2'
          )}
        >
          {isComplete ? <CheckIcon /> : step}
        </div>

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-display font-bold text-sm',
                isActive || isComplete ? 'text-text-0' : 'text-text-2'
              )}
            >
              {title}
            </span>
            {optional && (
              <span className="text-xs text-text-2 font-normal">optional</span>
            )}
          </div>
          {isCollapsed && summary && (
            <p className="text-xs text-text-2 mt-0.5 truncate">{summary}</p>
          )}
        </div>

        {/* Edit indicator for completed collapsed steps */}
        {isCollapsed && isComplete && (
          <span className="text-xs text-accent font-medium shrink-0">Edit</span>
        )}
      </button>

      {/* Expandable content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
