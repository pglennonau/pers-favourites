-- Pers Favourites 0.27.20 role-separation migration.
-- Run only when moving a rollout to the production/shared authentication model.
-- Existing legacy `admin` remains accepted for backwards compatibility.
-- New technical accounts should use `sysadmin`; Owner data rights and System Administrator technical rights are separate.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner','sysadmin','admin','viewer'));
alter table public.profiles add column if not exists roles text[] not null default '{}'::text[];
update public.profiles set roles=array[role]::text[] where cardinality(roles)=0;
alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check check (roles <@ array['owner','sysadmin','admin','viewer']::text[] and cardinality(roles) >= 1);

alter table public.venue_photos drop constraint if exists venue_photos_uploader_role_check;
alter table public.venue_photos add constraint venue_photos_uploader_role_check check (uploader_role in ('owner','sysadmin','admin','viewer'));

create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and (p.role=p_role or p_role=any(coalesce(p.roles,'{}'::text[])))
  );
$$;

-- Owner content/editor permissions are separate from System Administrator technical permissions.
-- Legacy `admin` keeps combined permissions for backwards compatibility only.
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path=''
as $$ select public.has_role('owner') or public.has_role('admin'); $$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path=''
as $$ select public.has_role('owner'); $$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select public.has_role('sysadmin') or public.has_role('admin'); $$;

revoke all on function public.has_role(text) from public, anon;
revoke all on function public.is_system_admin() from public, anon;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_system_admin() to authenticated;


-- Direct app_settings updates are removed. Owner changes only collection fields through a scoped RPC;
-- System Administrator changes only technical Google endpoint through its separate RPC.
revoke update on table public.app_settings from authenticated;
drop policy if exists app_settings_write on public.app_settings;

create or replace function public.set_owner_collection_settings(
  p_app_name text,
  p_owner_display_name text,
  p_home_region text,
  p_allow_user_photos boolean,
  p_ask_pers_enabled boolean
)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not public.is_owner() then
    raise exception 'Owner permission required';
  end if;
  update public.app_settings
     set app_name=coalesce(nullif(btrim(p_app_name),''),'Pers Favourites'),
         owner_display_name=nullif(btrim(p_owner_display_name),''),
         home_region=nullif(btrim(p_home_region),''),
         allow_user_photos=coalesce(p_allow_user_photos,true),
         ask_pers_enabled=coalesce(p_ask_pers_enabled,false),
         updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_owner_collection_settings(text,text,text,boolean,boolean) from public, anon;
grant execute on function public.set_owner_collection_settings(text,text,text,boolean,boolean) to authenticated;

-- Ask Pers technical endpoint belongs to System Administrator; Owner only controls enable/disable.
create or replace function public.set_ask_pers_endpoint(p_endpoint text)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not public.is_system_admin() then
    raise exception 'System Administrator permission required';
  end if;
  update public.app_settings
     set ask_pers_endpoint=nullif(btrim(p_endpoint),''), updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_ask_pers_endpoint(text) from public, anon;
grant execute on function public.set_ask_pers_endpoint(text) to authenticated;

-- Google/Places technical configuration belongs to System Administrator, not Owner.
create or replace function public.set_places_search_endpoint(p_endpoint text)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not public.is_system_admin() then
    raise exception 'System Administrator permission required';
  end if;
  update public.app_settings
     set places_search_endpoint=nullif(btrim(p_endpoint),''), updated_at=now()
   where id=1;
end; $$;
revoke all on function public.set_places_search_endpoint(text) from public, anon;
grant execute on function public.set_places_search_endpoint(text) to authenticated;

-- Profile display information may be changed only by the profile owner; role fields remain trigger-protected.
drop policy if exists profile_owner_update on public.profiles;
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Browser users cannot promote, remove or otherwise alter protected roles.
-- Owner/System Administrator role assignment must be done through a protected backend/admin process.
create or replace function public.protect_profile_roles()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is not null and (new.role is distinct from old.role or new.roles is distinct from old.roles) then
    raise exception 'Role changes require protected backend administration';
  end if;
  return new;
end; $$;
revoke all on function public.protect_profile_roles() from public, anon, authenticated;
drop trigger if exists profile_role_protect on public.profiles;
drop trigger if exists profile_roles_protect on public.profiles;
create trigger profile_roles_protect before update on public.profiles for each row execute procedure public.protect_profile_roles();

-- Sysadmin can read profiles for authorised administration; ordinary users still see only their own profile.
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated
using (id=auth.uid() or public.is_editor() or public.is_system_admin());

-- System Administrator may perform the explicitly exposed bulk-import workflow without receiving update/delete rights.
drop policy if exists places_insert on public.places;
create policy places_insert on public.places for insert to authenticated
with check (public.is_editor() or public.is_system_admin());

-- System Administrator may create/read technical pre-import snapshots.
drop policy if exists snapshots_editor_read on public.audit_snapshots;
drop policy if exists snapshots_editor_insert on public.audit_snapshots;
create policy snapshots_editor_read on public.audit_snapshots for select to authenticated
using (public.is_editor() or public.is_system_admin());
create policy snapshots_editor_insert on public.audit_snapshots for insert to authenticated
with check (public.is_editor() or public.is_system_admin());

-- Photo identity trigger recognises sysadmin as a protected role, but technical role alone does not grant moderation.
create or replace function public.prepare_venue_photo_insert()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r text; n text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.role, p.display_name into r, n from public.profiles p where p.id=auth.uid();
  new.uploaded_by=auth.uid();
  new.uploader_role=coalesce(r,'viewer');
  new.uploader_display_name=coalesce(nullif(n,''),'User');
  if not public.is_editor() then
    new.status='pending'; new.is_cover=false; new.moderated_by=null; new.moderated_at=null;
  end if;
  new.updated_at=now();
  return new;
end; $$;

-- Full backup is available to Owner/editor and System Administrator.
create or replace function public.export_full_backup()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  if not (public.is_editor() or public.is_system_admin()) then raise exception 'Owner or System Administrator access required'; end if;
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

-- New sign-ups should carry the viewer role in both compatibility and multi-role fields.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.profiles(id,email,display_name,role,roles)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),'viewer',array['viewer']::text[])
  on conflict(id) do nothing;
  return new;
end; $$;

-- Example protected assignments, performed manually by the rollout administrator only:
-- Per as Owner:
-- update public.profiles set role='owner', roles=array['owner']::text[], display_name='Per' where email='OWNER_EMAIL_HERE';
-- Pat during setup/handover (technical System Administrator + temporary Owner access):
-- update public.profiles set role='sysadmin', roles=array['sysadmin','owner']::text[], display_name='Pat' where email='PAT_EMAIL_HERE';
-- After handover, remove Pat's Owner access while retaining technical control:
-- update public.profiles set roles=array['sysadmin']::text[] where email='PAT_EMAIL_HERE';
