-- Pers Favourites PWA 0.27.16
-- Supports multiple selected banner photos and persistent Google Places photo references.

drop index if exists public.venue_photos_one_cover_idx;

alter table public.places add column if not exists google_place_id text;
alter table public.places add column if not exists google_photo_ref text;
alter table public.places add column if not exists google_photo_attribution jsonb not null default '[]'::jsonb;

create index if not exists places_google_place_id_idx on public.places(google_place_id) where google_place_id is not null;
