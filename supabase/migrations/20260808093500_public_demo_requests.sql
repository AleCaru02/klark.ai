create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text,
  sector text not null check (char_length(sector) between 2 and 120),
  call_volume text,
  main_goal text not null check (char_length(main_goal) between 2 and 160),
  existing_number boolean,
  notes text,
  selected_plan text,
  referral_code text,
  source text not null default 'website-demo',
  consent boolean not null check (consent = true),
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  request_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_requests_created_at_idx on public.demo_requests (created_at desc);
create index if not exists demo_requests_status_idx on public.demo_requests (status, created_at desc);
create index if not exists demo_requests_fingerprint_idx on public.demo_requests (request_fingerprint, created_at desc);

alter table public.demo_requests enable row level security;
revoke all on table public.demo_requests from anon;
revoke all on table public.demo_requests from authenticated;

comment on table public.demo_requests is 'Public website demo requests. Reads and writes are service-role only and exposed through role-checked Edge Functions.';
