-- Add custom name for team competition (replaces "War Mode")
ALTER TABLE trips ADD COLUMN IF NOT EXISTS competition_name TEXT DEFAULT 'The Cup';
