-- Fix missing ON DELETE CASCADE on groups.scorer_player_id
-- This was causing FK violations when deleting trips with rounds/groups

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_scorer_player_id_fkey;
ALTER TABLE groups ADD CONSTRAINT groups_scorer_player_id_fkey
  FOREIGN KEY (scorer_player_id) REFERENCES players(id) ON DELETE SET NULL;
