-- Pers Favourites v0.27.20 -> v0.27.21
-- Adds controlled master lists, external provider metadata, TripAdvisor endpoint configuration and Open Now support.

alter table public.app_settings add column if not exists tripadvisor_endpoint text;
alter table public.app_settings add column if not exists master_lists jsonb not null default '{}'::jsonb;

alter table public.places add column if not exists google_rating numeric(2,1);
alter table public.places add column if not exists google_rating_count integer;
alter table public.places add column if not exists open_now boolean;
alter table public.places add column if not exists opening_hours jsonb not null default '[]'::jsonb;
alter table public.places add column if not exists tripadvisor_location_id text;
alter table public.places add column if not exists tripadvisor_url text;
alter table public.places add column if not exists tripadvisor_rating numeric(2,1);
alter table public.places add column if not exists tripadvisor_rating_count integer;

create or replace function public.set_master_lists(p_master_lists jsonb)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not (public.is_owner() or public.is_system_admin()) then
    raise exception 'Owner or System Administrator permission required';
  end if;
  update public.app_settings
     set master_lists=coalesce(p_master_lists,'{}'::jsonb), updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_master_lists(jsonb) from public, anon;
grant execute on function public.set_master_lists(jsonb) to authenticated;

create or replace function public.set_tripadvisor_endpoint(p_endpoint text)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not public.is_system_admin() then
    raise exception 'System Administrator permission required';
  end if;
  update public.app_settings
     set tripadvisor_endpoint=nullif(btrim(p_endpoint),''), updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_tripadvisor_endpoint(text) from public, anon;
grant execute on function public.set_tripadvisor_endpoint(text) to authenticated;
