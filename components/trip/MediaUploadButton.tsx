'use client'

import { useState, useRef, useCallback } from 'react'
import { uploadTripMediaAction } from '@/lib/supabase/media-actions'
import { cn } from '@/lib/utils'

interface MediaUploadButtonProps {
  tripId: string
  onUploadComplete?: () => void
  className?: string
}

export function MediaUploadButton({
  tripId,
  onUploadComplete,
  className,
}: MediaUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showCaptionModal, setShowCaptionModal] = useState(false)
  const [caption, setCaption] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (50MB max)')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Only images and videos are supported')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Create preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }

    setShowCaptionModal(true)

    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    setUploading(true)
    setProgress(10)
    setError(null)

    try {
      // Read file as base64
      setProgress(20)
      const base64 = await fileToBase64(selectedFile)
      setProgress(40)

      // Upload
      const result = await uploadTripMediaAction({
        tripId,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileBase64: base64,
        caption: caption.trim() || undefined,
      })

      setProgress(90)

      if (!result.success) {
        setError(result.error || 'Upload failed')
        setUploading(false)
        return
      }

      setProgress(100)

      // Clean up
      setTimeout(() => {
        setShowCaptionModal(false)
        setSelectedFile(null)
        setCaption('')
        setPreviewUrl(null)
        setUploading(false)
        setProgress(0)
        onUploadComplete?.()
      }, 500)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }, [selectedFile, tripId, caption, onUploadComplete])

  const handleCancel = useCallback(() => {
    setShowCaptionModal(false)
    setSelectedFile(null)
    setCaption('')
    setError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [previewUrl])

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Floating Action Button */}
      <button
        onClick={handleClick}
        disabled={uploading}
        className={cn(
          'fixed bottom-20 right-4 z-50',
          'flex h-14 w-14 items-center justify-center',
          'rounded-full bg-accent shadow-lg shadow-accent/25',
          'text-bg-0 transition-all active:scale-[0.95]',
          'hover:brightness-110 disabled:opacity-50',
          className
        )}
        aria-label="Upload photo or video"
      >
        {uploading ? (
          <SpinnerIcon className="h-6 w-6 animate-spin" />
        ) : (
          <CameraIcon className="h-6 w-6" />
        )}
      </button>

      {/* Caption Modal */}
      {showCaptionModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-t-card sm:rounded-card bg-bg-1 border border-stroke p-5">
            {/* Preview */}
            {previewUrl && (
              <div className="mb-4 overflow-hidden rounded-card-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-48 w-full object-cover"
                />
              </div>
            )}

            {selectedFile && !previewUrl && (
              <div className="mb-4 flex items-center gap-3 rounded-card-sm bg-bg-2 p-3">
                <VideoIcon className="h-8 w-8 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-0 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-text-2">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            )}

            {/* Caption input */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              maxLength={280}
              className="mb-4 w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !uploading) handleUpload()
              }}
            />

            {/* Error message */}
            {error && (
              <p className="mb-3 text-sm text-bad">{error}</p>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="mb-4">
                <div className="h-1.5 w-full rounded-full bg-bg-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-center text-xs text-text-2">
                  Uploading...
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="flex-1 rounded-button border border-stroke bg-bg-2 px-4 min-h-button text-sm font-medium text-text-1 transition-all hover:bg-bg-2/80 active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 rounded-button bg-accent px-4 min-h-button text-sm font-medium text-bg-0 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Share'}
              </button>
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Icons
// ============================================================================

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
      />
    </svg>
  )
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
