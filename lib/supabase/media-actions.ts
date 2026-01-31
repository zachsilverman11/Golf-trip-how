'use server'

import { createClient } from './server'
import { getCurrentUser } from './auth-actions'
import { revalidatePath } from 'next/cache'
import type { DbTripMedia } from './types'

// ============================================================================
// Types
// ============================================================================

export interface UploadMediaInput {
  tripId: string
  fileName: string
  fileType: string
  fileBase64: string // Base64 encoded file data
  caption?: string
  roundId?: string
  holeNumber?: number
}

export interface MediaActionResult {
  success: boolean
  media?: DbTripMedia
  error?: string
}

// ============================================================================
// Upload Trip Media
// ============================================================================

export async function uploadTripMediaAction(
  input: UploadMediaInput
): Promise<MediaActionResult> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify user is a trip member
    const { data: membership } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', input.tripId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'Not a member of this trip' }
    }

    // Get player name for denormalization
    const { data: player } = await supabase
      .from('players')
      .select('name')
      .eq('trip_id', input.tripId)
      .eq('user_id', user.id)
      .single()

    const playerName = player?.name || user.email?.split('@')[0] || 'Unknown'

    // Determine media type
    const mediaType = input.fileType.startsWith('video/') ? 'video' : 'image'

    // Generate unique file path
    const ext = input.fileName.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg')
    const fileId = crypto.randomUUID()
    const storagePath = `${input.tripId}/${fileId}.${ext}`

    // Decode base64 and upload to Supabase Storage
    const base64Data = input.fileBase64.includes(',')
      ? input.fileBase64.split(',')[1]
      : input.fileBase64
    const buffer = Buffer.from(base64Data, 'base64')

    const { error: uploadError } = await supabase.storage
      .from('trip-media')
      .upload(storagePath, buffer, {
        contentType: input.fileType,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    // Create database record
    const { data: media, error: dbError } = await supabase
      .from('trip_media')
      .insert({
        trip_id: input.tripId,
        uploaded_by: user.id,
        player_name: playerName,
        storage_path: storagePath,
        media_type: mediaType,
        caption: input.caption || null,
        round_id: input.roundId || null,
        hole_number: input.holeNumber || null,
      })
      .select('*')
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      // Clean up uploaded file
      await supabase.storage.from('trip-media').remove([storagePath])
      return { success: false, error: `Failed to save media record: ${dbError.message}` }
    }

    revalidatePath(`/trip/${input.tripId}`)
    revalidatePath(`/trip/${input.tripId}/media`)

    return { success: true, media: media as DbTripMedia }
  } catch (err) {
    console.error('Upload media error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload media',
    }
  }
}

// ============================================================================
// Get Trip Media
// ============================================================================

export async function getTripMediaAction(tripId: string): Promise<{
  media: (DbTripMedia & { publicUrl: string })[]
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { media: [], error: 'Not authenticated' }
  }

  try {
    const { data: mediaItems, error } = await supabase
      .from('trip_media')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get media error:', error)
      return { media: [], error: error.message }
    }

    // Generate public URLs for each media item
    const mediaWithUrls = (mediaItems || []).map((item: DbTripMedia) => {
      const { data: urlData } = supabase.storage
        .from('trip-media')
        .getPublicUrl(item.storage_path)

      return {
        ...item,
        publicUrl: urlData.publicUrl,
      }
    })

    return { media: mediaWithUrls }
  } catch (err) {
    console.error('Get media error:', err)
    return {
      media: [],
      error: err instanceof Error ? err.message : 'Failed to load media',
    }
  }
}

// ============================================================================
// Delete Trip Media
// ============================================================================

export async function deleteTripMediaAction(mediaId: string): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get the media record first to find storage path
    const { data: media, error: fetchError } = await supabase
      .from('trip_media')
      .select('*')
      .eq('id', mediaId)
      .single()

    if (fetchError || !media) {
      return { success: false, error: 'Media not found' }
    }

    // Verify ownership
    if (media.uploaded_by !== user.id) {
      return { success: false, error: 'Can only delete your own media' }
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('trip-media')
      .remove([media.storage_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue to delete DB record even if storage delete fails
    }

    // Delete thumbnail if exists
    if (media.thumbnail_path) {
      await supabase.storage
        .from('trip-media')
        .remove([media.thumbnail_path])
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from('trip_media')
      .delete()
      .eq('id', mediaId)

    if (dbError) {
      console.error('DB delete error:', dbError)
      return { success: false, error: `Failed to delete: ${dbError.message}` }
    }

    revalidatePath(`/trip/${media.trip_id}`)
    revalidatePath(`/trip/${media.trip_id}/media`)

    return { success: true }
  } catch (err) {
    console.error('Delete media error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete media',
    }
  }
}
