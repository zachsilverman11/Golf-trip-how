-- ============================================================================
-- New Bet Formats: Nassau, Skins, Wolf
-- ============================================================================
-- Adds nassau, skins, and wolf to the format constraint on rounds.
-- Creates supporting tables for each format's state tracking.
-- ============================================================================

-- Update the format constraint to include new formats
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_format_check;
ALTER TABLE rounds ADD CONSTRAINT rounds_format_check
  CHECK (format IN ('stroke_play', 'match_play', 'points_hilo', 'stableford', 'scramble', 'nassau', 'skins', 'wolf'));

-- ============================================================================
-- NASSAU: Three sub-matches (front 9, back 9, overall 18)
-- ============================================================================

CREATE TABLE IF NOT EXISTS nassau_bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,

  -- Stake per player per sub-bet (total exposure = stake * 3)
  stake_per_man NUMERIC(10,2) NOT NULL DEFAULT 5,

  -- Auto-press: when down 2 in any sub-match, press is auto-triggered
  auto_press BOOLEAN NOT NULL DEFAULT false,
  auto_press_threshold INTEGER NOT NULL DEFAULT 2,

  -- Teams (reuses the same player refs as match_play)
  team_a_player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_a_player2_id UUID REFERENCES players(id) ON DELETE CASCADE,
  team_b_player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_b_player2_id UUID REFERENCES players(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (round_id)
);

-- ============================================================================
-- SKINS: Hole-by-hole individual format
-- ============================================================================

CREATE TABLE IF NOT EXISTS skins_bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,

  -- Value per skin
  skin_value NUMERIC(10,2) NOT NULL DEFAULT 5,

  -- Carry over on ties
  carryover BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (round_id)
);

-- ============================================================================
-- WOLF: Rotating captain format (4 players required)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wolf_bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,

  -- Stake per hole per man
  stake_per_hole NUMERIC(10,2) NOT NULL DEFAULT 2,

  -- Lone wolf multiplier (e.g. 2 = double stakes)
  lone_wolf_multiplier INTEGER NOT NULL DEFAULT 2,

  -- Tee order (array of player IDs in rotation order)
  tee_order UUID[] NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (round_id)
);

-- Wolf hole decisions (per-hole captain choices)
CREATE TABLE IF NOT EXISTS wolf_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wolf_bet_id UUID NOT NULL REFERENCES wolf_bets(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),

  -- Who is the wolf for this hole
  wolf_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- Partner chosen (NULL = lone wolf)
  partner_player_id UUID REFERENCES players(id) ON DELETE CASCADE,

  -- Lone wolf flag
  is_lone_wolf BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (wolf_bet_id, hole_number)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nassau_bets_round ON nassau_bets (round_id);
CREATE INDEX IF NOT EXISTS idx_skins_bets_round ON skins_bets (round_id);
CREATE INDEX IF NOT EXISTS idx_wolf_bets_round ON wolf_bets (round_id);
CREATE INDEX IF NOT EXISTS idx_wolf_decisions_bet ON wolf_decisions (wolf_bet_id);

-- ============================================================================
-- RLS policies (inherit trip membership via rounds)
-- ============================================================================

ALTER TABLE nassau_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE skins_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wolf_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wolf_decisions ENABLE ROW LEVEL SECURITY;

-- Nassau: users with trip access can read/write
CREATE POLICY "nassau_bets_access" ON nassau_bets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN trip_members tm ON tm.trip_id = r.trip_id
      WHERE r.id = nassau_bets.round_id AND tm.user_id = auth.uid()
    )
  );

-- Skins: users with trip access can read/write
CREATE POLICY "skins_bets_access" ON skins_bets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN trip_members tm ON tm.trip_id = r.trip_id
      WHERE r.id = skins_bets.round_id AND tm.user_id = auth.uid()
    )
  );

-- Wolf: users with trip access can read/write
CREATE POLICY "wolf_bets_access" ON wolf_bets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rounds r
      JOIN trip_members tm ON tm.trip_id = r.trip_id
      WHERE r.id = wolf_bets.round_id AND tm.user_id = auth.uid()
    )
  );

-- Wolf decisions: users with trip access can read/write
CREATE POLICY "wolf_decisions_access" ON wolf_decisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wolf_bets wb
      JOIN rounds r ON r.id = wb.round_id
      JOIN trip_members tm ON tm.trip_id = r.trip_id
      WHERE wb.id = wolf_decisions.wolf_bet_id AND tm.user_id = auth.uid()
    )
  );
