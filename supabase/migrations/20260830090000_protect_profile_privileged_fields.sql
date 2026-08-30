-- Prevent signed-in users from granting themselves admin or paid access, or
-- changing Stripe-managed profile state. This migration intentionally leaves
-- normal profile fields editable by their owner.
--
-- Production prerequisite: compare this protected-column list with the live
-- public.profiles schema and every live writer before applying this migration.

begin;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- PostgREST changes current_user to the JWT database role. Permit trusted
  -- backend/service operations and Supabase administrative SQL, while applying
  -- the guard to anon/authenticated clients regardless of RLS policy changes.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'member'
      or new.membership_tier not in ('free')
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.subscription_status not in ('inactive')
      or new.subscription_period_end is not null
    then
      raise exception 'Profile role, membership, and billing fields are managed by the server'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if new.role is distinct from old.role
    or new.membership_tier is distinct from old.membership_tier
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_period_end is distinct from old.subscription_period_end
  then
    raise exception 'Profile role, membership, and billing fields are managed by the server'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public;
revoke all on function public.protect_profile_privileged_fields() from anon;
revoke all on function public.protect_profile_privileged_fields() from authenticated;
grant execute on function public.protect_profile_privileged_fields() to service_role;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
before insert or update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

-- The live database was reported to contain both policies below. Consolidate
-- them so ownership remains explicit and future reviews have one policy to
-- reason about. Column immutability is enforced by the trigger above.
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own non-tier fields" on public.profiles;

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

commit;
