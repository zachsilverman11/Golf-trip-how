-- Migration: Create trips, rounds, players, groups, and scores tables
-- Run this in your Supabase SQL editor or via supabase db push

-- ============================================================================
-- TRIPS TABLE (top-level container)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  spectator_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_trips_created_by ON trips (created_by);

-- Trigger for updated_at
CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TRIP_MEMBERS TABLE (who can access)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Index for membership lookups
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members (user_id);

-- Trigger for updated_at
CREATE TRIGGER trip_members_updated_at
  BEFORE UPDATE ON trip_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PLAYERS TABLE (per trip, not necessarily auth users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handicap_index DECIMAL(4,1),
  user_id UUID REFERENCES auth.users(id), -- optional link
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for trip lookups
CREATE INDEX IF NOT EXISTS idx_players_trip ON players (trip_id);
CREATE INDEX IF NOT EXISTS idx_players_user ON players (user_id);

-- Trigger for updated_at
CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROUNDS TABLE (one day's play)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  tee_id UUID REFERENCES tees(id),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  format TEXT NOT NULL DEFAULT 'stroke_play' CHECK (format IN ('stroke_play', 'best_ball', 'scramble', 'match_play')),
  scoring_basis TEXT NOT NULL DEFAULT 'net' CHECK (scoring_basis IN ('gross', 'net')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for trip lookups
CREATE INDEX IF NOT EXISTS idx_rounds_trip ON rounds (trip_id);
CREATE INDEX IF NOT EXISTS idx_rounds_tee ON rounds (tee_id);

-- Trigger for updated_at
CREATE TRIGGER rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- GROUPS TABLE (within a round)
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  scorer_player_id UUID REFERENCES players(id),
  tee_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for round lookups
CREATE INDEX IF NOT EXISTS idx_groups_round ON groups (round_id);

-- Trigger for updated_at
CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- GROUP_PLAYERS TABLE (junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS group_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  playing_handicap INTEGER, -- calculated course handicap
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, player_id)
);

-- Index for group lookups
CREATE INDEX IF NOT EXISTS idx_group_players_group ON group_players (group_id);
CREATE INDEX IF NOT EXISTS idx_group_players_player ON group_players (player_id);

-- Trigger for updated_at
CREATE TRIGGER group_players_updated_at
  BEFORE UPDATE ON group_players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SCORES TABLE (individual hole scores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  gross_strokes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_id, player_id, hole_number)
);

-- Index for round and player lookups
CREATE INDEX IF NOT EXISTS idx_scores_round ON scores (round_id);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores (player_id);
CREATE INDEX IF NOT EXISTS idx_scores_round_player ON scores (round_id, player_id);

-- Trigger for updated_at
CREATE TRIGGER scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Check trip membership
-- ============================================================================
CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check trip admin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_trip_admin(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- TRIPS: Members can read, admins can update, creators can insert
CREATE POLICY "Trip members can read trips" ON trips
  FOR SELECT USING (is_trip_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create trips" ON trips
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Trip admins can update trips" ON trips
  FOR UPDATE USING (is_trip_admin(id, auth.uid()));

CREATE POLICY "Trip admins can delete trips" ON trips
  FOR DELETE USING (is_trip_admin(id, auth.uid()));

-- TRIP_MEMBERS: Members can read, admins can modify
CREATE POLICY "Trip members can read memberships" ON trip_members
  FOR SELECT USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip admins can insert members" ON trip_members
  FOR INSERT WITH CHECK (is_trip_admin(trip_id, auth.uid()) OR
    -- Allow first member (creator) to add themselves as admin
    NOT EXISTS (SELECT 1 FROM trip_members WHERE trip_id = trip_members.trip_id));

CREATE POLICY "Trip admins can update members" ON trip_members
  FOR UPDATE USING (is_trip_admin(trip_id, auth.uid()));

CREATE POLICY "Trip admins can delete members" ON trip_members
  FOR DELETE USING (is_trip_admin(trip_id, auth.uid()));

-- PLAYERS: Trip members can read/write
CREATE POLICY "Trip members can read players" ON players
  FOR SELECT USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can insert players" ON players
  FOR INSERT WITH CHECK (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can update players" ON players
  FOR UPDATE USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip admins can delete players" ON players
  FOR DELETE USING (is_trip_admin(trip_id, auth.uid()));

-- ROUNDS: Trip members can read/write
CREATE POLICY "Trip members can read rounds" ON rounds
  FOR SELECT USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can insert rounds" ON rounds
  FOR INSERT WITH CHECK (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip members can update rounds" ON rounds
  FOR UPDATE USING (is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Trip admins can delete rounds" ON rounds
  FOR DELETE USING (is_trip_admin(trip_id, auth.uid()));

-- GROUPS: Access through round's trip
CREATE POLICY "Trip members can read groups" ON groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can insert groups" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can update groups" ON groups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip admins can delete groups" ON groups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_admin(r.trip_id, auth.uid()))
  );

-- GROUP_PLAYERS: Access through group's round's trip
CREATE POLICY "Trip members can read group players" ON group_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN rounds r ON r.id = g.round_id
      WHERE g.id = group_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip members can insert group players" ON group_players
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN rounds r ON r.id = g.round_id
      WHERE g.id = group_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip members can update group players" ON group_players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN rounds r ON r.id = g.round_id
      WHERE g.id = group_id AND is_trip_member(r.trip_id, auth.uid())
    )
  );

CREATE POLICY "Trip admins can delete group players" ON group_players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN rounds r ON r.id = g.round_id
      WHERE g.id = group_id AND is_trip_admin(r.trip_id, auth.uid())
    )
  );

-- SCORES: Access through round's trip
CREATE POLICY "Trip members can read scores" ON scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can insert scores" ON scores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip members can update scores" ON scores
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_member(r.trip_id, auth.uid()))
  );

CREATE POLICY "Trip admins can delete scores" ON scores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM rounds r WHERE r.id = round_id AND is_trip_admin(r.trip_id, auth.uid()))
  );

-- ============================================================================
-- SPECTATOR RPC FUNCTIONS
-- ============================================================================

-- Get trip by spectator token (public access)
CREATE OR REPLACE FUNCTION get_trip_by_spectator_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  start_date DATE,
  end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.start_date, t.end_date
  FROM trips t
  WHERE t.spectator_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get leaderboard by spectator token
CREATE OR REPLACE FUNCTION get_leaderboard_by_spectator_token(
  p_token TEXT,
  p_round_id UUID DEFAULT NULL
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  handicap_index DECIMAL(4,1),
  total_gross INTEGER,
  total_net INTEGER,
  holes_played INTEGER,
  thru INTEGER
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
    p.id as player_id,
    p.name as player_name,
    p.handicap_index,
    COALESCE(SUM(s.gross_strokes), 0)::INTEGER as total_gross,
    COALESCE(SUM(s.gross_strokes), 0)::INTEGER as total_net, -- Will be calculated properly in app
    COUNT(s.id)::INTEGER as holes_played,
    MAX(s.hole_number)::INTEGER as thru
  FROM players p
  LEFT JOIN scores s ON s.player_id = p.id
  LEFT JOIN rounds r ON r.id = s.round_id
  WHERE p.trip_id = v_trip_id
    AND (p_round_id IS NULL OR s.round_id = p_round_id)
  GROUP BY p.id, p.name, p.handicap_index
  ORDER BY total_gross ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE REALTIME FOR SCORES TABLE
-- ============================================================================
-- Note: Also need to enable in Supabase Dashboard > Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
