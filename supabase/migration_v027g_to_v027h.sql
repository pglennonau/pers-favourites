-- Pers Favourites v027g -> v027h
-- No table/data migration is required. This adds a narrow RPC so an authenticated Owner/Admin
-- can save the Google Places Worker endpoint without receiving permission to change other app settings.

create or replace function public.set_places_search_endpoint(p_endpoint text)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin')) then
    raise exception 'Owner/Admin permission required';
  end if;
  update public.app_settings
     set places_search_endpoint=nullif(btrim(p_endpoint),''), updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_places_search_endpoint(text) from public, anon;
grant execute on function public.set_places_search_endpoint(text) to authenticated;
