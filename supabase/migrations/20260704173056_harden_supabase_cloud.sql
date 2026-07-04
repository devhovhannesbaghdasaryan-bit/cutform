-- Keep privileged helpers out of the exposed Data API surface.
create schema if not exists private;
revoke all on schema private from public;

alter function public.is_admin(uuid) set schema private;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_admin(uuid) to anon, authenticated, service_role;

-- Trigger/event-trigger entrypoints must not be callable as RPC functions.
revoke all on function public.handle_new_user() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- Pin lookup paths so object resolution cannot be redirected by a caller.
alter function public.set_updated_at() set search_path = '';
alter function public.ensure_currency_settings_valid() set search_path = '';

-- Public buckets are readable through public object URLs. Broad SELECT policies
-- additionally allow directory listing, so retain only the admin management rules.
drop policy if exists "public reads catalog assets" on storage.objects;
drop policy if exists "public reads banner assets" on storage.objects;
