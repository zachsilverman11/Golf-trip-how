-- Enable realtime for scores table
-- (matches and presses already added in 003_money_games.sql)
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
