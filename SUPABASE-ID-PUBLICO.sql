alter table public.users
add column if not exists public_id text;

update public.users
set public_id = (1254879548 + id - 1)::text
where public_id is null or public_id = '' or public_id ~ '^0+[0-9]+$';

create unique index if not exists users_public_id_unique_idx on public.users (public_id);
create index if not exists users_public_id_idx on public.users (public_id);
