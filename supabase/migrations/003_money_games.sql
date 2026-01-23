-- Migration: Create matches and presses tables for Money Games v1
-- Run this in your Supabase SQL editor or via supabase db push

-- ============================================================================
-- MATCHES TABLE (one match per round)
-- ============================================================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('1v1', '2v2')),
  stake_per_hole DECIMAL(10,2) NOT NULL DEFAULT 1.00,

  -- Team A
  team_a_player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_a_player2_id UUID REFERENCES players(id) ON DELETE CASCADE, -- nullable for 1v1

  -- Team B
  team_b_player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_b_player2_id UUID REFERENCES players(id) ON DELETE CASCADE, -- nullable for 1v1

  -- Match state (computed from scores, persisted for performance)
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'canceled')),
  winner TEXT CHECK (winner IN ('team_a', 'team_b', 'halved')),
  final_result TEXT, -- e.g., "3&2", "1 UP", "A/S"
  current_lead INTEGER NOT NULL DEFAULT 0, -- positive = Team A up, negative = Team B up
  holes_played INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One match per round
  UNIQUE(round_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches (round_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

-- Trigger for updated_at
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PRESSES TABLE (sub-matches starting mid-round)
-- ============================================================================
CREATE TABLE IF NOT EXISTS presses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  starting_hole INTEGER NOT NULL CHECK (starting_hole >= 1 AND starting_hole <= 18),
  stake_per_hole DECIMAL(10,2) NOT NULL, -- Frozen at creation time

  -- Press state (computed from scores, persisted for performance)
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'canceled')),
  winner TEXT CHECK (winner IN ('team_a', 'team_b', 'halved')),
  final_result TEXT, -- e.g., "2&1", "1 UP", "A/S"
  current_lead INTEGER NOT NULL DEFAULT 0,
  holes_played INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for match lookups
CREATE INDEX IF NOT EXISTS idx_presses_match ON presses (match_id);

-- Trigger for updated_at
CREATE TRIGGER presses_updated_at
  BEFORE UPDATE ON presses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE presses ENABLE ROW LEVEL SECURITY;

-- MATCHES: Access through round's trip
CREATE POLICY "Trip members can read matches" ON matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can insert matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can update matches" ON matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip admins can delete matches" ON matches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_admin(r.trip_id, auth.uid()))
  );

-- PRESSES: Access through match's round's trip
CREATE POLICY "Trip members can read presses" ON presses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = match_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip members can insert presses" ON presses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = match_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip members can update presses" ON presses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = match_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip admins can delete presses" ON presses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = match_id AND is_trip_admin(r.trip_id, auth.uid())
    )
  );

-- ============================================================================
-- SPECTATOR FUNCTION: Get match by spectator token
-- ============================================================================
CREATE OR REPLACE FUNCTION get_match_by_spectator_token(
  p_token TEXT,
  p_round_id UUID DEFAULT NULL
)
RETURNS TABLE (
  match_id UUID,
  round_id UUID,
  match_type TEXT,
  stake_per_hole DECIMAL(10,2),
  team_a_player1_id UUID,
  team_a_player1_name TEXT,
  team_a_player2_id UUID,
  team_a_player2_name TEXT,
  team_b_player1_id UUID,
  team_b_player1_name TEXT,
  team_b_player2_id UUID,
  team_b_player2_name TEXT,
  status TEXT,
  winner TEXT,
  final_result TEXT,
  current_lead INTEGER,
  holes_played INTEGER
) AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  -- Get trip ID from token
  SELECT t.id INTO v_trip_id FROM trips t WHERE t.spectator_token = p_token;

  IF v_trip_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id as match_id,
    m.round_id,
    m.match_type,
    m.stake_per_hole,
    m.team_a_player1_id,
    pa1.name as team_a_player1_name,
    m.team_a_player2_id,
    pa2.name as team_a_player2_name,
    m.team_b_player1_id,
    pb1.name as team_b_player1_name,
    m.team_b_player2_id,
    pb2.name as team_b_player2_name,
    m.status,
    m.winner,
    m.final_result,
    m.current_lead,
    m.holes_played
  FROM matches m
  JOIN rounds r ON r.id = m.round_id
  JOIN players pa1 ON pa1.id = m.team_a_player1_id
  LEFT JOIN players pa2 ON pa2.id = m.team_a_player2_id
  JOIN players pb1 ON pb1.id = m.team_b_player1_id
  LEFT JOIN players pb2 ON pb2.id = m.team_b_player2_id
  WHERE r.trip_id = v_trip_id
    AND (p_round_id IS NULL OR m.round_id = p_round_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE REALTIME FOR MATCHES AND PRESSES
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE presses;
