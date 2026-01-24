-- Trip-level war setting
ALTER TABLE trips ADD COLUMN IF NOT EXISTS war_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Trip team assignments for War mode
CREATE TABLE IF NOT EXISTS trip_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('A', 'B')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_id, player_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_trip_team_assignments_trip ON trip_team_assignments(trip_id);

-- RLS policies
ALTER TABLE trip_team_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read trip team assignments
CREATE POLICY "Users can view trip team assignments"
  ON trip_team_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete trip team assignments
CREATE POLICY "Users can manage trip team assignments"
  ON trip_team_assignments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
