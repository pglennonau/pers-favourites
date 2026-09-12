-- Pers Favourites v026 -> v027e migration
-- Run in the EXISTING rollout Supabase project before deploying v027e application files.

alter table public.app_settings add column if not exists ask_pers_enabled boolean not null default false;
alter table public.app_settings add column if not exists ask_pers_endpoint text;

alter table public.places add column if not exists pers_rating numeric(2,1) check (pers_rating between 0 and 5);

create table if not exists public.venue_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, place_id)
);
create table if not exists public.venue_rating_summary (
  place_id uuid primary key references public.places(id) on delete cascade,
  average_rating numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.venue_ratings enable row level security;
alter table public.venue_rating_summary enable row level security;
revoke all on table public.venue_ratings, public.venue_rating_summary from anon, authenticated;
grant select, insert, update, delete on table public.venue_ratings to authenticated;
grant select on table public.venue_rating_summary to anon, authenticated;
drop policy if exists venue_ratings_self on public.venue_ratings;
create policy venue_ratings_self on public.venue_ratings for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists venue_rating_summary_read on public.venue_rating_summary;
create policy venue_rating_summary_read on public.venue_rating_summary for select to anon, authenticated using (true);
create or replace function public.validate_viewer_rating() returns trigger language plpgsql security definer set search_path='' as $$ declare r text; begin select p.role into r from public.profiles p where p.id=auth.uid(); if r is distinct from 'viewer' then raise exception 'Owner/Admin ratings do not count as User Ratings'; end if; new.user_id=auth.uid(); new.updated_at=now(); return new; end; $$;
revoke all on function public.validate_viewer_rating() from public, anon, authenticated;
drop trigger if exists venue_rating_before_write on public.venue_ratings;
create trigger venue_rating_before_write before insert or update on public.venue_ratings for each row execute procedure public.validate_viewer_rating();
create or replace function public.refresh_venue_rating_summary() returns trigger language plpgsql security definer set search_path='' as $$ declare pid uuid; begin if TG_OP='DELETE' then pid=old.place_id; else pid=new.place_id; end if; insert into public.venue_rating_summary(place_id,average_rating,rating_count,updated_at) select pid,coalesce(round(avg(rating)::numeric,2),0),count(*),now() from public.venue_ratings where place_id=pid on conflict(place_id) do update set average_rating=excluded.average_rating,rating_count=excluded.rating_count,updated_at=excluded.updated_at; if TG_OP='DELETE' then return old; else return new; end if; end; $$;
revoke all on function public.refresh_venue_rating_summary() from public, anon, authenticated;
drop trigger if exists venue_rating_after_write on public.venue_ratings;
create trigger venue_rating_after_write after insert or update or delete on public.venue_ratings for each row execute procedure public.refresh_venue_rating_summary();


-- v027e full logical database export. This does not expose Supabase Auth password hashes or secrets.
-- Owner/Admin may create an explicit backup that includes all application tables; photo binaries are
-- downloaded separately by the PWA and embedded in the exported backup file.
create or replace function public.export_full_backup()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_editor() then raise exception 'Administrator access required'; end if;
  return jsonb_build_object(
    'schema_version', 275,
    'exported_at', now(),
    'app_settings', (select to_jsonb(x) from public.app_settings x where id=1),
    'profiles', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.profiles x),'[]'::jsonb),
    'places', coalesce((select jsonb_agg(to_jsonb(x) order by x.name) from public.places x),'[]'::jsonb),
    'venue_photos', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.venue_photos x),'[]'::jsonb),
    'venue_ratings', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.venue_ratings x),'[]'::jsonb),
    'venue_rating_summary', coalesce((select jsonb_agg(to_jsonb(x) order by x.place_id) from public.venue_rating_summary x),'[]'::jsonb),
    'personal_place_data', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at) from public.personal_place_data x),'[]'::jsonb),
    'visits', coalesce((select jsonb_agg(to_jsonb(x) order by x.visited_at) from public.visits x),'[]'::jsonb),
    'user_preferences', coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at) from public.user_preferences x),'[]'::jsonb),
    'audit_snapshots', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.audit_snapshots x),'[]'::jsonb)
  );
end; $$;
revoke all on function public.export_full_backup() from public, anon;
grant execute on function public.export_full_backup() to authenticated;
