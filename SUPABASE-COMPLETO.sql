create table if not exists public.users (
  id bigserial primary key,
  nickname text not null,
  cpf text not null,
  public_id text,
  password_hash text not null,
  salt text not null,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists nickname text;
alter table public.users add column if not exists cpf text;
alter table public.users add column if not exists public_id text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists salt text;
alter table public.users add column if not exists created_at timestamptz not null default now();

update public.users
set public_id = (1254879548 + id - 1)::text
where public_id is null or public_id = '' or public_id ~ '^0+[0-9]+$';

alter table public.users alter column public_id set not null;

create unique index if not exists users_nickname_unique_idx on public.users (lower(nickname));
create unique index if not exists users_cpf_unique_idx on public.users (cpf);
create unique index if not exists users_public_id_unique_idx on public.users (public_id);
create index if not exists users_public_id_idx on public.users (public_id);

create table if not exists public.sessions (
  token text primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  expires_at bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);

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

create table if not exists public.user_scores (
  user_id bigint primary key references public.users(id) on delete cascade,
  points integer not null default 0,
  wins integer not null default 0,
  last_game text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_scores_points_idx on public.user_scores (points desc);
create index if not exists user_scores_wins_idx on public.user_scores (wins desc);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.friendships enable row level security;
alter table public.user_scores enable row level security;
