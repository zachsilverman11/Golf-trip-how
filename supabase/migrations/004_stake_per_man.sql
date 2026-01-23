-- Migration: Rename stake_per_hole to stake_per_man for clarity
-- Stakes are PER MAN (per player), not per team
-- In a 2v2 with $10/man, each winning player wins $10, each losing player loses $10

-- Rename column in matches table
ALTER TABLE matches RENAME COLUMN stake_per_hole TO stake_per_man;

-- Rename column in presses table
ALTER TABLE presses RENAME COLUMN stake_per_hole TO stake_per_man;

-- Update the spectator function to use new column name
CREATE OR REPLACE FUNCTION get_match_by_spectator_token(
  p_token TEXT,
  p_round_id UUID DEFAULT NULL
)
RETURNS TABLE (
  match_id UUID,
  round_id UUID,
  match_type TEXT,
  stake_per_man DECIMAL(10,2),
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
    m.stake_per_man,
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
