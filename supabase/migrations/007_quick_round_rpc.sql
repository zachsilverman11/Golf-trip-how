-- ============================================================================
-- Quick Round RPC: Atomic creation of trip, round, players, and groups
-- ============================================================================
-- This SECURITY DEFINER function bypasses RLS to create all Quick Round
-- entities in a single atomic transaction. This solves the race condition
-- where players INSERT fails because the trip_member record isn't yet visible.
-- ============================================================================

-- Drop existing function if it exists (for re-running migration)
DROP FUNCTION IF EXISTS create_quick_round(jsonb);

-- Create the Quick Round RPC
CREATE OR REPLACE FUNCTION create_quick_round(payload jsonb)
RETURNS TABLE (trip_id uuid, round_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_trip_id uuid;
  v_round_id uuid;
  v_group_id uuid;
  v_player_ids uuid[];
  v_player record;
  v_player_id uuid;
  v_idx int;
  v_today date;
  v_display_date text;
  v_tee_time_ts timestamptz;
  v_round_name text;
  v_format text;
  v_player_count int;
  v_team_assignments jsonb;
  v_team_number int;
BEGIN
  -- ========================================================================
  -- 1. AUTH CHECK
  -- ========================================================================
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ========================================================================
  -- 2. VALIDATE PAYLOAD
  -- ========================================================================
  -- Check players array exists and has at least 1 player
  IF NOT (payload ? 'players') OR jsonb_array_length(payload->'players') < 1 THEN
    RAISE EXCEPTION 'At least one player is required';
  END IF;

  v_player_count := jsonb_array_length(payload->'players');
  v_format := COALESCE(payload->>'format', 'stroke_play');

  -- Validate format
  IF v_format NOT IN ('stroke_play', 'match_play', 'points_hilo', 'stableford') THEN
    RAISE EXCEPTION 'Invalid format: %', v_format;
  END IF;

  -- Format-specific validation
  IF v_format = 'match_play' THEN
    -- Match play: 2 players (1v1) or 4 players (2v2)
    IF v_player_count NOT IN (2, 4) THEN
      RAISE EXCEPTION 'Match play requires 2 players (1v1) or 4 players (2v2)';
    END IF;
    -- 4 players requires team assignments
    IF v_player_count = 4 AND NOT (payload ? 'teamAssignments') THEN
      RAISE EXCEPTION 'Match play with 4 players requires team assignments';
    END IF;
  ELSIF v_format = 'points_hilo' THEN
    -- Points Hi/Lo: exactly 4 players with teams
    IF v_player_count != 4 THEN
      RAISE EXCEPTION 'Points Hi/Lo requires exactly 4 players';
    END IF;
    IF NOT (payload ? 'teamAssignments') THEN
      RAISE EXCEPTION 'Points Hi/Lo requires team assignments';
    END IF;
  END IF;

  -- Validate team assignments if provided
  IF payload ? 'teamAssignments' THEN
    v_team_assignments := payload->'teamAssignments';
    -- Ensure exactly 2 players per team for 4-player formats
    IF v_player_count = 4 THEN
      IF (SELECT COUNT(*) FROM jsonb_each_text(v_team_assignments) WHERE value = '1') != 2 THEN
        RAISE EXCEPTION 'Team assignments must have exactly 2 players per team';
      END IF;
      IF (SELECT COUNT(*) FROM jsonb_each_text(v_team_assignments) WHERE value = '2') != 2 THEN
        RAISE EXCEPTION 'Team assignments must have exactly 2 players per team';
      END IF;
    END IF;
  END IF;

  -- ========================================================================
  -- 3. PREPARE DATES AND NAMES
  -- ========================================================================
  v_today := CURRENT_DATE;
  v_display_date := to_char(v_today, 'Mon DD');
  v_round_name := COALESCE(payload->>'courseName', 'Quick Round');

  -- Build tee time timestamp if provided
  IF payload->>'teeTime' IS NOT NULL AND payload->>'teeTime' != '' THEN
    v_tee_time_ts := (v_today::text || 'T' || (payload->>'teeTime') || ':00')::timestamptz;
  END IF;

  -- ========================================================================
  -- 4. CREATE TRIP
  -- ========================================================================
  INSERT INTO trips (
    name,
    description,
    start_date,
    end_date,
    created_by
  ) VALUES (
    'Quick Round - ' || v_display_date,
    CASE
      WHEN payload->>'courseName' IS NOT NULL THEN 'Quick round at ' || (payload->>'courseName')
      ELSE 'Quick round'
    END,
    v_today,
    v_today,
    v_user_id
  )
  RETURNING id INTO v_trip_id;

  -- ========================================================================
  -- 5. ADD USER AS TRIP ADMIN
  -- ========================================================================
  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (v_trip_id, v_user_id, 'admin');

  -- ========================================================================
  -- 6. CREATE PLAYERS
  -- ========================================================================
  v_idx := 0;
  FOR v_player IN SELECT * FROM jsonb_array_elements(payload->'players')
  LOOP
    INSERT INTO players (trip_id, name, handicap_index)
    VALUES (
      v_trip_id,
      v_player.value->>'name',
      CASE
        WHEN v_player.value->>'handicap' IS NOT NULL AND v_player.value->>'handicap' != ''
        THEN (v_player.value->>'handicap')::decimal(4,1)
        ELSE NULL
      END
    )
    RETURNING id INTO v_player_id;

    v_player_ids := array_append(v_player_ids, v_player_id);
    v_idx := v_idx + 1;
  END LOOP;

  -- ========================================================================
  -- 7. CREATE ROUND
  -- ========================================================================
  INSERT INTO rounds (
    trip_id,
    tee_id,
    name,
    date,
    tee_time,
    format,
    scoring_basis,
    status
  ) VALUES (
    v_trip_id,
    CASE
      WHEN payload->>'teeId' IS NOT NULL AND payload->>'teeId' != ''
      THEN (payload->>'teeId')::uuid
      ELSE NULL
    END,
    v_round_name,
    v_today,
    v_tee_time_ts,
    v_format,
    COALESCE(payload->>'scoringBasis', 'net'),
    'upcoming'
  )
  RETURNING id INTO v_round_id;

  -- ========================================================================
  -- 8. CREATE GROUP
  -- ========================================================================
  INSERT INTO groups (
    round_id,
    group_number,
    scorer_player_id,
    tee_time
  ) VALUES (
    v_round_id,
    1,
    v_player_ids[1],
    CASE
      WHEN payload->>'teeTime' IS NOT NULL AND payload->>'teeTime' != ''
      THEN (payload->>'teeTime')::time
      ELSE NULL
    END
  )
  RETURNING id INTO v_group_id;

  -- ========================================================================
  -- 9. ADD PLAYERS TO GROUP (with team assignments)
  -- ========================================================================
  v_team_assignments := payload->'teamAssignments';

  FOR v_idx IN 1..array_length(v_player_ids, 1)
  LOOP
    -- Determine team number from assignments or NULL
    v_team_number := NULL;
    IF v_team_assignments IS NOT NULL THEN
      -- Team assignments are keyed by draft player ID (index-based for quick round)
      -- We need to map by array position
      SELECT (v_team_assignments->>((v_idx - 1)::text))::int INTO v_team_number;
    END IF;

    INSERT INTO group_players (
      group_id,
      player_id,
      playing_handicap,
      team_number
    ) VALUES (
      v_group_id,
      v_player_ids[v_idx],
      (SELECT
        CASE
          WHEN (payload->'players'->(v_idx - 1)->>'handicap') IS NOT NULL
               AND (payload->'players'->(v_idx - 1)->>'handicap') != ''
          THEN ((payload->'players'->(v_idx - 1)->>'handicap')::decimal)::int
          ELSE NULL
        END
      ),
      v_team_number
    );
  END LOOP;

  -- ========================================================================
  -- 10. RETURN RESULTS
  -- ========================================================================
  RETURN QUERY SELECT v_trip_id, v_round_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_quick_round(jsonb) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION create_quick_round(jsonb) IS 'Atomically creates a Quick Round with trip, round, players, and group assignments. Bypasses RLS via SECURITY DEFINER.';
