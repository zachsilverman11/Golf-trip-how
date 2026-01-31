'use client'

import { useState, useCallback } from 'react'
import { deleteTripMediaAction } from '@/lib/supabase/media-actions'
import { ShareButton } from '@/components/ui/ShareButton'
import { cn } from '@/lib/utils'
import type { DbTripMedia } from '@/lib/supabase/types'

interface MediaItem extends DbTripMedia {
  publicUrl: string
}

interface MediaGalleryProps {
  media: MediaItem[]
  currentUserId?: string
  onMediaDeleted?: () => void
  className?: string
}

export function MediaGallery({
  media,
  currentUserId,
  onMediaDeleted,
  className,
}: MediaGalleryProps) {
  const [viewingMedia, setViewingMedia] = useState<MediaItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)

  const handleDelete = useCallback(async (mediaId: string) => {
    setDeletingId(mediaId)
    const result = await deleteTripMediaAction(mediaId)
    if (result.success) {
      setViewingMedia(null)
      setShowMenu(null)
      onMediaDeleted?.()
    }
    setDeletingId(null)
  }, [onMediaDeleted])

  if (media.length === 0) {
    return (
      <div className={cn('rounded-card border border-stroke bg-bg-1 p-8 text-center', className)}>
        <div className="mb-3 text-3xl opacity-40">📸</div>
        <h3 className="mb-1 font-display text-lg font-bold text-text-0">
          No photos yet
        </h3>
        <p className="text-sm text-text-2">
          Tap the camera button to share moments from the trip
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Grid */}
      <div className={cn('grid grid-cols-3 gap-1', className)}>
        {media.map((item) => (
          <button
            key={item.id}
            onClick={() => setViewingMedia(item)}
            className="relative aspect-square overflow-hidden rounded-card-sm bg-bg-2 transition-transform active:scale-[0.98]"
          >
            {item.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.publicUrl}
                alt={item.caption || 'Trip photo'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="relative h-full w-full bg-bg-2">
                <video
                  src={item.publicUrl}
                  className="h-full w-full object-cover"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                    <PlayIcon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Caption indicator */}
            {item.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <p className="text-xs text-white truncate">{item.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Fullscreen Viewer */}
      {viewingMedia && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          {/* Top bar */}
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => {
                setViewingMedia(null)
                setShowMenu(null)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <ShareButton
                title="Trip Photo"
                text={viewingMedia.caption
                  ? `📸 ${viewingMedia.caption} — by ${viewingMedia.player_name}`
                  : `📸 Photo by ${viewingMedia.player_name}`}
                url={viewingMedia.publicUrl}
                className="text-white hover:bg-white/10"
              />

              {currentUserId === viewingMedia.uploaded_by && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(showMenu ? null : viewingMedia.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                  >
                    <MoreIcon className="h-5 w-5" />
                  </button>

                  {showMenu === viewingMedia.id && (
                    <div className="absolute right-0 top-full mt-1 w-36 rounded-card-sm border border-stroke bg-bg-1 py-1 shadow-lg">
                      <button
                        onClick={() => handleDelete(viewingMedia.id)}
                        disabled={deletingId === viewingMedia.id}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-bad hover:bg-bg-2 disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {deletingId === viewingMedia.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Media */}
          <div className="flex flex-1 items-center justify-center p-4">
            {viewingMedia.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewingMedia.publicUrl}
                alt={viewingMedia.caption || 'Trip photo'}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <video
                src={viewingMedia.publicUrl}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full"
              />
            )}
          </div>

          {/* Bottom info */}
          <div className="p-4 pb-safe">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-white">
                  {viewingMedia.player_name}
                </p>
                {viewingMedia.caption && (
                  <p className="mt-1 text-sm text-white/70">
                    {viewingMedia.caption}
                  </p>
                )}
                <p className="mt-1 text-xs text-white/50">
                  {formatTimestamp(viewingMedia.created_at)}
                  {viewingMedia.hole_number && ` · Hole ${viewingMedia.hole_number}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
