-- ============================================================================
-- Round Formats v1: Points Hi/Lo and Stableford
-- ============================================================================
-- Adds team_number to group_players for format-based team assignments
-- Updates rounds.format to include points_hilo and stableford
-- Adds rounds.tee_time for round-level tee time
-- ============================================================================

-- Add team_number to group_players (1 = Team 1, 2 = Team 2, NULL = no team)
ALTER TABLE group_players
ADD COLUMN team_number INTEGER CHECK (team_number IN (1, 2));

-- Add tee_time to rounds (round-level tee time)
ALTER TABLE rounds
ADD COLUMN tee_time TIMESTAMPTZ;

-- Update the format constraint to include new formats
-- Keeps stroke_play as foundational format, adds points_hilo and stableford
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_format_check;
ALTER TABLE rounds ADD CONSTRAINT rounds_format_check
  CHECK (format IN ('stroke_play', 'match_play', 'points_hilo', 'stableford'));

-- Keep stroke_play as default (foundational format)

-- Index for efficient team queries
CREATE INDEX idx_group_players_team ON group_players (team_number) WHERE team_number IS NOT NULL;

-- ============================================================================
-- RLS policies for team_number (inherits from group_players existing policies)
-- No additional policies needed - group_players already has proper RLS
-- ============================================================================
