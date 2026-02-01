-- Migration: Add junk/side bets system
-- Junk bets are an overlay that runs alongside any round format.

-- ============================================================================
-- JUNK_BETS TABLE (individual junk claims per hole)
-- ============================================================================
CREATE TABLE IF NOT EXISTS junk_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  junk_type TEXT NOT NULL CHECK (junk_type IN ('greenie', 'sandy', 'barkie', 'polie', 'snake', 'birdie', 'eagle')),
  value INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A player can only have one claim per junk type per hole
  UNIQUE(round_id, player_id, hole_number, junk_type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_junk_bets_round ON junk_bets (round_id);
CREATE INDEX IF NOT EXISTS idx_junk_bets_round_hole ON junk_bets (round_id, hole_number);
CREATE INDEX IF NOT EXISTS idx_junk_bets_player ON junk_bets (player_id);

-- ============================================================================
-- ADD junk_config JSONB column to rounds table
-- Stores the junk bet configuration (which types are enabled + values)
-- ============================================================================
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS junk_config JSONB DEFAULT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY for junk_bets
-- ============================================================================
ALTER TABLE junk_bets ENABLE ROW LEVEL SECURITY;

-- Trip members can read junk bets (through round's trip)
CREATE POLICY "Trip members can read junk bets" ON junk_bets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

-- Trip members can insert junk bets
CREATE POLICY "Trip members can insert junk bets" ON junk_bets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

-- Trip members can update junk bets
CREATE POLICY "Trip members can update junk bets" ON junk_bets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

-- Trip members can delete junk bets (unclaim)
CREATE POLICY "Trip members can delete junk bets" ON junk_bets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

-- ============================================================================
-- ENABLE REALTIME for junk_bets
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE junk_bets;
