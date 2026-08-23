-- Hucha de casa: tickets de supermercado línea a línea.
-- Run this in the Supabase SQL editor (or via supabase db push).

create extension if not exists "pgcrypto";

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  unique (user_id),
  unique (household_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  canonical_name text not null,
  category text not null default 'otros'
    check (category in ('comida', 'bebida', 'limpieza', 'otros')),
  created_at timestamptz not null default now()
);

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  alias text not null,
  unique (household_id, alias)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  store text not null,
  purchased_at timestamptz not null,
  total_cents integer not null,
  payment_method text,
  invoice_number text,
  photo_path text,
  lines_sum_cents integer,
  mismatch boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_lines (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  raw_name text not null,
  quantity numeric(12, 3) not null default 1,
  unit_cents integer not null,
  amount_cents integer not null,
  vat_rate numeric(5, 2),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists tickets_household_purchased_idx
  on public.tickets (household_id, purchased_at desc);

create index if not exists ticket_lines_product_idx
  on public.ticket_lines (household_id, product_id);

create index if not exists ticket_lines_ticket_idx
  on public.ticket_lines (ticket_id);

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_member_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    display_name,
    split_part(coalesce(auth.jwt() ->> 'email', 'yo'), '@', 1)
  )
  from public.members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  row_out public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'name too short';
  end if;

  insert into public.households (name, invite_code)
  values (trim(p_name), public.generate_invite_code())
  returning id into hid;

  insert into public.members (household_id, user_id, display_name)
  values (
    hid,
    auth.uid(),
    split_part(coalesce(auth.jwt() ->> 'email', 'yo'), '@', 1)
  );

  select * into row_out from public.households where id = hid;
  return row_out;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  row_out public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;

  select id into hid
  from public.households
  where invite_code = upper(trim(p_code));

  if hid is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.members (household_id, user_id, display_name)
  values (
    hid,
    auth.uid(),
    split_part(coalesce(auth.jwt() ->> 'email', 'yo'), '@', 1)
  );

  select * into row_out from public.households where id = hid;
  return row_out;
end;
$$;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_lines enable row level security;

create policy households_select on public.households
  for select to authenticated
  using (id = public.current_household_id());

create policy members_select on public.members
  for select to authenticated
  using (household_id = public.current_household_id());

create policy members_update_self on public.members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy products_all on public.products
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy aliases_all on public.product_aliases
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy tickets_select on public.tickets
  for select to authenticated
  using (household_id = public.current_household_id());

create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and created_by = auth.uid()
  );

create policy tickets_update on public.tickets
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy tickets_delete on public.tickets
  for delete to authenticated
  using (household_id = public.current_household_id());

create policy ticket_lines_all on public.ticket_lines
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Storage bucket for ticket photos. Path: {household_id}/{ticket_id}.jpg
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

create policy tickets_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tickets'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy tickets_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tickets'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy tickets_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tickets'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy tickets_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tickets'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_aliases to authenticated;
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.ticket_lines to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.current_household_id() to authenticated;
grant execute on function public.current_member_name() to authenticated;
