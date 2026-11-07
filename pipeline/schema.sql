-- Internal to the data side; change freely (not part of the frozen glue).

CREATE TABLE IF NOT EXISTS stops (
  stop_id TEXT PRIMARY KEY,
  name TEXT,
  lat REAL,
  lon REAL,
  wheelchair_boarding INTEGER,
  parent_station TEXT,
  is_blue_line INTEGER DEFAULT 0,
  blue_line_seq INTEGER            -- order along the line (direction_id 0, toward UTC); NULL if not Blue Line
);

CREATE TABLE IF NOT EXISTS blue_line_times (  -- median ride minutes between Blue Line stops
  from_stop_id TEXT,
  to_stop_id TEXT,
  minutes REAL,
  PRIMARY KEY (from_stop_id, to_stop_id)
);

CREATE TABLE IF NOT EXISTS closures (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT,
  description TEXT,
  alternative TEXT,
  alternative_stop_ids TEXT,       -- JSON array
  stop_id TEXT,
  osm_node INTEGER,
  geom_geojson TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_text TEXT,
  ai_generated INTEGER DEFAULT 0,
  active_until TEXT
);

CREATE TABLE IF NOT EXISTS curb_ramps (
  id TEXT PRIMARY KEY,
  lat REAL,
  lon REAL,
  osm_node INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS gemini_cache (
  input_hash TEXT PRIMARY KEY,
  task TEXT,
  output_json TEXT
);
