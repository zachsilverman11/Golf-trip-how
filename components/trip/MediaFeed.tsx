'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { ShareButton } from '@/components/ui/ShareButton'
import { deleteTripMediaAction } from '@/lib/supabase/media-actions'
import { cn } from '@/lib/utils'
import type { DbTripMedia } from '@/lib/supabase/types'

interface MediaItem extends DbTripMedia {
  publicUrl: string
}

interface MediaFeedProps {
  media: MediaItem[]
  currentUserId?: string
  onMediaDeleted?: () => void
  className?: string
}

export function MediaFeed({
  media,
  currentUserId,
  onMediaDeleted,
  className,
}: MediaFeedProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleDelete = useCallback(async (mediaId: string) => {
    if (!confirm('Delete this media?')) return
    setDeletingId(mediaId)
    const result = await deleteTripMediaAction(mediaId)
    if (result.success) {
      onMediaDeleted?.()
    }
    setDeletingId(null)
  }, [onMediaDeleted])

  if (media.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {media.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          {/* Player header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {(item.player_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-text-0">
                  {item.player_name}
                </p>
                <p className="text-xs text-text-2">
                  {formatTimestamp(item.created_at)}
                  {item.hole_number ? ` · Hole ${item.hole_number}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <ShareButton
                title="Trip Photo"
                text={item.caption
                  ? `📸 ${item.caption} — by ${item.player_name}`
                  : `📸 Photo by ${item.player_name}`}
                url={item.publicUrl}
              />
              {currentUserId === item.uploaded_by && (
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-2 hover:bg-bg-2 hover:text-text-1"
                >
                  <MoreIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Delete option */}
          {expandedId === item.id && currentUserId === item.uploaded_by && (
            <div className="border-t border-stroke px-4 py-2">
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="text-sm text-bad hover:underline disabled:opacity-50"
              >
                {deletingId === item.id ? 'Deleting...' : 'Delete this photo'}
              </button>
            </div>
          )}

          {/* Media */}
          <div className="bg-bg-2">
            {item.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.publicUrl}
                alt={item.caption || 'Trip photo'}
                className="w-full"
                loading="lazy"
              />
            ) : (
              <video
                src={item.publicUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full"
              />
            )}
          </div>

          {/* Caption */}
          {item.caption && (
            <div className="px-4 py-3">
              <p className="text-sm text-text-1">
                <span className="font-medium text-text-0">
                  {item.player_name}
                </span>{' '}
                {item.caption}
              </p>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Icons
// ============================================================================

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  )
}
