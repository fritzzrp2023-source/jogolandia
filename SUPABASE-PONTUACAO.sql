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

alter table public.user_scores enable row level security;
