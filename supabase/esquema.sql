-- Fase 2: mover los eventos de /data/eventos a Supabase (Postgres + PostGIS).
-- Ejecutar en el SQL Editor de Supabase cuando toque.

create extension if not exists postgis;

create table if not exists eventos (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  estado        text not null default 'pendiente' check (estado in ('pendiente','publicado','descartado')),
  titulo        text not null,
  titulo_gl     text,
  resumen       text,
  concello      text not null,
  parroquia     text,
  organizadores text[] default '{}',
  categorias    text[] default '{}',
  publico       text,
  precio        text,
  inscripcion   jsonb,
  extras        text[] default '{}',
  cartel_url    text,
  idioma        text,
  fuente        jsonb not null,           -- {canal, recibido, remitente?}
  inferido      text[] default '{}',
  confianza     real,
  recurrente    boolean default false,
  comercial     boolean default false,
  destacado_hasta timestamptz,            -- destacados de pago
  creado        timestamptz default now()
);

create table if not exists sesiones (
  id        bigserial primary key,
  evento_id uuid references eventos(id) on delete cascade,
  inicio    timestamp not null,           -- hora local de Galicia
  fin       timestamp,
  nota      text
);
create index on sesiones (inicio);

create table if not exists lugares (
  id        bigserial primary key,
  evento_id uuid references eventos(id) on delete cascade,
  nombre    text not null,
  direccion text,
  geo       geography(point, 4326) not null,
  aprox     boolean default true
);
create index on lugares using gist (geo);

-- Lectura pública solo de lo publicado
alter table eventos enable row level security;
alter table sesiones enable row level security;
alter table lugares enable row level security;
create policy "publico lee publicados" on eventos for select using (estado = 'publicado');
create policy "publico lee sesiones" on sesiones for select using (exists (select 1 from eventos e where e.id = evento_id and e.estado = 'publicado'));
create policy "publico lee lugares" on lugares for select using (exists (select 1 from eventos e where e.id = evento_id and e.estado = 'publicado'));
