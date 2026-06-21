create table if not exists public.friendships (
  id bigserial primary key,
  requester_id bigint not null references public.users(id) on delete cascade,
  addressee_id bigint not null references public.users(id) on delete cascade,
  user_low bigint not null,
  user_high bigint not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_low, user_high)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;
