-- Trip Feed Events table for real-time activity feed
CREATE TABLE trip_feed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'score', 'press', 'match_result', 'media', 'milestone', 'settlement', 'round_start', 'round_complete'
  )),
  player_name TEXT,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number INTEGER,
  headline TEXT NOT NULL,
  detail TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_feed_trip ON trip_feed_events(trip_id, created_at DESC);

ALTER TABLE trip_feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view feed"
  ON trip_feed_events FOR SELECT
  USING (trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid()));

CREATE POLICY "Trip members can insert feed events"
  ON trip_feed_events FOR INSERT
  WITH CHECK (trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid()));
