-- Trip media (photos/videos shared during a trip)
CREATE TABLE trip_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  player_name TEXT, -- denormalized for display
  storage_path TEXT NOT NULL, -- Supabase Storage path
  thumbnail_path TEXT, -- optional thumbnail for videos
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  round_id UUID REFERENCES rounds(id) ON DELETE SET NULL, -- optional context
  hole_number INTEGER CHECK (hole_number >= 1 AND hole_number <= 18),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_media_trip ON trip_media(trip_id, created_at DESC);

-- Enable RLS
ALTER TABLE trip_media ENABLE ROW LEVEL SECURITY;

-- Trip members can view media
CREATE POLICY "Trip members can view media"
  ON trip_media FOR SELECT
  USING (trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid()));

-- Trip members can insert media
CREATE POLICY "Trip members can insert media"
  ON trip_media FOR INSERT
  WITH CHECK (trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid()));

-- Users can delete their own media
CREATE POLICY "Users can delete own media"
  ON trip_media FOR DELETE
  USING (uploaded_by = auth.uid());
