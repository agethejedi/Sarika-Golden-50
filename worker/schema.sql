-- Sarika Golden 50 — D1 Database Schema
-- Run this in Cloudflare Dashboard → D1 → your-database → Console

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'photo',   -- 'photo' | 'video'
  caption     TEXT DEFAULT '',
  author      TEXT DEFAULT 'Guest',
  status      TEXT DEFAULT 'published',         -- 'published' | 'hidden'
  featured    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'thumb' | 'wow' | 'fire'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  name        TEXT DEFAULT 'Guest',
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_queue (
  id              TEXT PRIMARY KEY,
  url             TEXT NOT NULL,
  caption         TEXT DEFAULT '',
  status          TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'denied' | 'enhance'
  sarika_comment  TEXT DEFAULT '',
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_queue(status);
