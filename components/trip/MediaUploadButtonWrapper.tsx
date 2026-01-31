'use client'

import { useRouter } from 'next/navigation'
import { MediaUploadButton } from './MediaUploadButton'

interface MediaUploadButtonWrapperProps {
  tripId: string
}

export function MediaUploadButtonWrapper({ tripId }: MediaUploadButtonWrapperProps) {
  const router = useRouter()

  return (
    <MediaUploadButton
      tripId={tripId}
      onUploadComplete={() => router.refresh()}
    />
  )
}
