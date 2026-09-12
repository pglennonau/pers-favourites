PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  deployment_id TEXT NOT NULL,
  app_name TEXT NOT NULL DEFAULT 'Pers Favourites',
  owner_display_name TEXT NOT NULL DEFAULT 'Owner',
  home_region TEXT NOT NULL DEFAULT '',
  allow_user_photos INTEGER NOT NULL DEFAULT 1,
  ask_pers_enabled INTEGER NOT NULL DEFAULT 0,
  ask_pers_daily_limit INTEGER NOT NULL DEFAULT 50,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_list_options (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  options TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('owner','admin','viewer','contributor')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  place_type TEXT,
  cuisine TEXT,
  country TEXT,
  state_region TEXT,
  city TEXT,
  suburb TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  price TEXT,
  meal_types TEXT NOT NULL DEFAULT '[]',
  great_for TEXT NOT NULL DEFAULT '[]',
  features TEXT NOT NULL DEFAULT '[]',
  dietary TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  must_try TEXT,
  notes TEXT,
  website TEXT,
  google_maps_url TEXT,
  phone TEXT,
  booking_url TEXT,
  source_name TEXT,
  source_id TEXT,
  source_url TEXT,
  source_checked_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);
CREATE INDEX IF NOT EXISTS idx_places_city ON places(city);
CREATE INDEX IF NOT EXISTS idx_places_archived ON places(archived_at);

CREATE TABLE IF NOT EXISTS venue_photos (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploader_display_name TEXT,
  uploader_role TEXT NOT NULL DEFAULT 'contributor',
  caption TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden')),
  is_cover INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  moderated_by TEXT,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_photos_place ON venue_photos(place_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON venue_photos(status);

CREATE TABLE IF NOT EXISTS personal_place_data (
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  favourite INTEGER NOT NULL DEFAULT 0,
  want_to_visit INTEGER NOT NULL DEFAULT 0,
  visited INTEGER NOT NULL DEFAULT 0,
  private_note TEXT,
  last_visited TEXT,
  would_go_again TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(user_id, place_id),
  FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  rating INTEGER,
  comment TEXT,
  FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visits_user_date ON visits(user_id, visited_at DESC);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_snapshots (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_transactions (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  transaction_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_usage (
  usage_date TEXT NOT NULL,
  requester_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(usage_date, requester_hash)
);
