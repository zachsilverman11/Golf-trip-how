-- Migration: Add club_name to courses table
-- Purpose: Store the facility/club name separately from the course name
--          This enables proper display like "Pacific Dunes at Bandon Dunes"

-- Add club_name column (nullable for backward compatibility)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS club_name TEXT;

-- Add index for club_name queries (for grouping courses by facility)
CREATE INDEX IF NOT EXISTS idx_courses_club_name ON courses (club_name) WHERE club_name IS NOT NULL;

-- Comment explaining the relationship
COMMENT ON COLUMN courses.club_name IS 'The facility/resort name (e.g., "Bandon Dunes"). The courses.name column stores the specific course name (e.g., "Pacific Dunes"). When club_name differs from name, display as "name at club_name".';
