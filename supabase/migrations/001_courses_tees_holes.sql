-- Migration: Create courses, tees, and holes tables
-- Run this in your Supabase SQL editor or via supabase db push

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COURSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  country TEXT NOT NULL DEFAULT 'US' CHECK (country IN ('US', 'CA', 'other')),
  external_provider TEXT,  -- e.g., 'golfcourseapi'
  external_id TEXT,        -- provider's course ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching by name
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses USING gin(to_tsvector('english', name));

-- Index for external lookups (prevent duplicates from same provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external
  ON courses (external_provider, external_id)
  WHERE external_provider IS NOT NULL AND external_id IS NOT NULL;

-- ============================================================================
-- TEES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  rating DECIMAL(4,1) NOT NULL,  -- e.g., 72.4
  slope INTEGER NOT NULL CHECK (slope >= 55 AND slope <= 155),
  par INTEGER NOT NULL CHECK (par >= 54 AND par <= 90),  -- 18 holes * 3-5
  yards INTEGER,
  gender TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('male', 'female', 'unisex')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for course lookups
CREATE INDEX IF NOT EXISTS idx_tees_course ON tees (course_id);

-- Unique constraint: one tee name per course per gender
CREATE UNIQUE INDEX IF NOT EXISTS idx_tees_unique_name
  ON tees (course_id, name, gender);

-- ============================================================================
-- HOLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS holes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tee_id UUID NOT NULL REFERENCES tees(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  par INTEGER NOT NULL CHECK (par >= 3 AND par <= 5),
  stroke_index INTEGER NOT NULL DEFAULT 0 CHECK (stroke_index >= 0 AND stroke_index <= 18),
  yards INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tee lookups
CREATE INDEX IF NOT EXISTS idx_holes_tee ON holes (tee_id);

-- Unique constraint: one hole number per tee
CREATE UNIQUE INDEX IF NOT EXISTS idx_holes_unique_number
  ON holes (tee_id, hole_number);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tees_updated_at
  BEFORE UPDATE ON tees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- For now, allow all operations (we'll add auth later)
-- ============================================================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tees ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read on courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Allow public read on tees" ON tees FOR SELECT USING (true);
CREATE POLICY "Allow public read on holes" ON holes FOR SELECT USING (true);

-- Public insert/update for now (will restrict to authenticated users later)
CREATE POLICY "Allow public insert on courses" ON courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on tees" ON tees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on holes" ON holes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on courses" ON courses FOR UPDATE USING (true);
CREATE POLICY "Allow public update on tees" ON tees FOR UPDATE USING (true);

-- ============================================================================
-- SEED DATA (Sample course for testing)
-- ============================================================================
-- Run this separately or comment out for production

-- INSERT INTO courses (id, name, location, country, external_provider, external_id)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   'Sample Golf Club',
--   'San Francisco, CA',
--   'US',
--   NULL,
--   NULL
-- );

-- INSERT INTO tees (id, course_id, name, color, rating, slope, par, yards, gender)
-- VALUES (
--   'b0000000-0000-0000-0000-000000000001',
--   'a0000000-0000-0000-0000-000000000001',
--   'Blue',
--   '#0066CC',
--   71.2,
--   128,
--   72,
--   6500,
--   'male'
-- );

-- INSERT INTO holes (tee_id, hole_number, par, stroke_index, yards)
-- SELECT
--   'b0000000-0000-0000-0000-000000000001',
--   n,
--   CASE WHEN n IN (3, 7, 12, 16) THEN 3 WHEN n IN (5, 9, 14, 18) THEN 5 ELSE 4 END,
--   n,  -- Simple 1-18 stroke index
--   350 + (n * 10)
-- FROM generate_series(1, 18) AS n;
