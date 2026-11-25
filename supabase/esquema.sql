-- Axenda en Supabase: eventos pendientes de revisión y publicados, y los carteles en Storage.
-- Ejecutar entero en el SQL Editor de Supabase (se puede repetir: no borra datos).
--
-- El evento completo va en "datos" (jsonb) con el formato de src/lib/tipos.ts, que lo valida
-- en la app antes de publicar. Las columnas generadas sirven para filtrar y contar sin duplicar datos.
-- La app accede con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY) solo desde el servidor.

create table if not exists eventos (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'publicado', 'descartado')),
  datos        jsonb not null,
  -- Columnas derivadas de "datos" (solo lectura)
  titulo       text generated always as (datos->>'titulo') stored,
  concello     text generated always as (datos->>'concello') stored,
  inicio       text generated always as (datos->'sesiones'->0->>'inicio') stored,
  canal        text generated always as (datos->'fuente'->>'canal') stored,
  id_fuente    text generated always as (datos->'fuente'->>'id_fuente') stored,
  uid          text generated always as (datos->'fuente'->>'uid') stored,
  -- Huella del archivo recibido (cartel o PDF), para no procesar dos veces el mismo
  hash         text,
  -- Ruta del cartel en el bucket "carteles" de Storage
  cartel_path  text,
  -- Posibles duplicados: "evento:<slug>" o "pendiente:<id>"
  duplicados   text[] not null default '{}',
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),
  publicado    timestamptz,
  -- Destacados de pago (más adelante)
  destacado_hasta timestamptz
);

-- Un slug solo puede estar publicado una vez
create unique index if not exists eventos_slug_publicado on eventos (slug) where estado = 'publicado';
create index if not exists eventos_estado on eventos (estado, creado desc);
create index if not exists eventos_hash on eventos (hash) where hash is not null;
create index if not exists eventos_origen on eventos (id_fuente, uid) where uid is not null;
create index if not exists eventos_inicio on eventos (inicio);

-- Contacto de quien envió el evento (p. ej. su número de WhatsApp). PRIVADO:
-- solo para avisarle cuando se publique; se borra al avisarle o al descartar el evento.
create table if not exists contactos (
  evento_id uuid primary key references eventos (id) on delete cascade,
  canal     text not null check (canal in ('whatsapp', 'email')),
  valor     text not null,
  creado    timestamptz not null default now()
);

-- Seguridad: con RLS activado y sin políticas para "anon", la clave pública no ve nada.
-- La única lectura pública es la de los eventos publicados (por si algún día se lee desde el navegador).
alter table eventos enable row level security;
alter table contactos enable row level security;
drop policy if exists "publico lee publicados" on eventos;
create policy "publico lee publicados" on eventos for select to anon using (estado = 'publicado');

-- Storage: bucket público "carteles" (las rutas son UUID, no se pueden adivinar).
-- Solo la clave de servicio puede subir o borrar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carteles', 'carteles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Métricas propias (vistas de ficha, clics, apariciones en listados, cómo llegar, calendario, inscripción, compartir).
-- Solo contadores agregados por día: sin IP, sin navegador, sin identificadores (no hace falta banner de cookies).
-- ambito: total | evento | organizador | concello | categoria | segmento (destacado/normal)
create table if not exists metricas (
  dia    date   not null,
  ambito text   not null,
  clave  text   not null,
  tipo   text   not null,
  n      bigint not null default 0,
  primary key (dia, ambito, clave, tipo)
);
create index if not exists metricas_ambito on metricas (ambito, clave, dia);
alter table metricas enable row level security;

-- Suma atómica de contadores (la llama /api/m con la clave de servicio)
create or replace function sumar_metricas(filas jsonb) returns void
language sql security definer set search_path = public as $$
  insert into metricas (dia, ambito, clave, tipo, n)
  select (f->>'dia')::date, f->>'ambito', f->>'clave', f->>'tipo', (f->>'n')::bigint
  from jsonb_array_elements(filas) f
  on conflict (dia, ambito, clave, tipo) do update set n = metricas.n + excluded.n;
$$;
revoke execute on function sumar_metricas(jsonb) from public, anon, authenticated;
