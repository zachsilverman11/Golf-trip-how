-- ============================================================================
-- Add Scramble format
-- ============================================================================
-- Scramble: team format where all players hit, pick the best shot, repeat.
-- One score per team per hole. Stroke-based — lowest total team score wins.
-- Produces 1 war point (1/0.5/0) for team competition.
-- ============================================================================

-- Update the format constraint to include scramble
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_format_check;
ALTER TABLE rounds ADD CONSTRAINT rounds_format_check
  CHECK (format IN ('stroke_play', 'match_play', 'points_hilo', 'stableford', 'scramble'));
