-- Pers Favourites PWA v027e -> v027f (0.27.6)
-- Adds the secure Google Places endpoint setting and updates backup schema metadata.

alter table public.app_settings
  add column if not exists places_search_endpoint text;

create or replace function public.export_full_backup()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_editor() then raise exception 'Administrator access required'; end if;
  return jsonb_build_object(
    'schema_version', 276,
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
