-- Axenda en Turso (libSQL/SQLite). La app lo aplica sola al conectarse; este fichero es para consultarlo o ejecutarlo a mano
-- con: turso db shell <base> < turso/esquema.sql
-- Mismo formato que supabase/esquema.sql: el evento completo va en "datos" (JSON). Migración: npm run migrar-a-supabase
CREATE TABLE IF NOT EXISTS eventos (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'publicado', 'descartado')),
  datos       TEXT NOT NULL,
  id_fuente   TEXT GENERATED ALWAYS AS (json_extract(datos, '$.fuente.id_fuente')) VIRTUAL,
  uid         TEXT GENERATED ALWAYS AS (json_extract(datos, '$.fuente.uid')) VIRTUAL,
  hash        TEXT,
  cartel_url  TEXT,
  duplicados  TEXT NOT NULL DEFAULT '[]',
  creado      TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  publicado   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS eventos_slug_publicado ON eventos (slug) WHERE estado = 'publicado';
CREATE INDEX IF NOT EXISTS eventos_estado ON eventos (estado, creado);
CREATE INDEX IF NOT EXISTS eventos_hash ON eventos (hash);
CREATE INDEX IF NOT EXISTS eventos_origen ON eventos (id_fuente, uid);
CREATE TABLE IF NOT EXISTS carteles (
  id     TEXT PRIMARY KEY,
  tipo   TEXT NOT NULL,
  datos  BLOB NOT NULL,
  creado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contactos (
  evento_id TEXT PRIMARY KEY,
  canal     TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email')),
  valor     TEXT NOT NULL,
  creado    TEXT NOT NULL
);

-- Métricas propias (se crean solas la primera vez que se registra una; ver src/lib/metricas)
CREATE TABLE IF NOT EXISTS metricas (
  dia    TEXT NOT NULL,
  ambito TEXT NOT NULL,
  clave  TEXT NOT NULL,
  tipo   TEXT NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, ambito, clave, tipo)
);
CREATE INDEX IF NOT EXISTS metricas_ambito ON metricas (ambito, clave, dia);

-- Lugares habituales (se editan en /admin/lugares; la primera vez se rellenan con data/lugares.json)
CREATE TABLE IF NOT EXISTS lugares (
  clave       TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  concello    TEXT NOT NULL,
  parroquia   TEXT,
  direccion   TEXT,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  aprox       INTEGER NOT NULL DEFAULT 0,
  actualizado TEXT NOT NULL
);
