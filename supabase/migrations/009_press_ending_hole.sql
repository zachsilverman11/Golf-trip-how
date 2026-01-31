-- Migration: Add ending_hole to presses table
-- Supports front-9 presses (ending at hole 9) vs match presses (ending at hole 18)
-- Default 18 for existing presses (they all run to end of round)

ALTER TABLE presses ADD COLUMN IF NOT EXISTS ending_hole INTEGER NOT NULL DEFAULT 18 
  CHECK (ending_hole >= 1 AND ending_hole <= 18);

-- Ensure ending_hole >= starting_hole
ALTER TABLE presses ADD CONSTRAINT press_hole_range 
  CHECK (ending_hole >= starting_hole);
