-- Structured tenant onboarding data that should not live in a single prompt blob.
-- Existing settings columns remain the source of truth for runtime availability,
-- booking rules, timezone, language and Voice flags.

create table if not exists public.tenant_business_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  country_code text not null default 'IT',
  business_phone_e164 text,
  business_email text,
  website text,
  existing_phone_e164 text,
  existing_line_type text,
  forwarding_preference text not null default 'evaluate',
  callback_policy text,
  escalation_policy text,
  outside_hours_behavior text,
  ai_disclosure_confirmed boolean not null default false,
  callback_consent_required boolean not null default true,
  dnc_respected boolean not null default true,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_business_profiles_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint tenant_business_profiles_business_phone_check
    check (business_phone_e164 is null or business_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint tenant_business_profiles_existing_phone_check
    check (existing_phone_e164 is null or existing_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint tenant_business_profiles_line_type_check
    check (existing_line_type is null or existing_line_type in ('landline','mobile','voip','pbx','unknown')),
  constraint tenant_business_profiles_forwarding_check
    check (forwarding_preference in ('evaluate','none','conditional','always'))
);

create table if not exists public.tenant_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer,
  price_cents integer,
  disclose_price boolean not null default false,
  appointment_enabled boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_services_name_check check (length(trim(name)) between 1 and 160),
  constraint tenant_services_duration_check check (duration_minutes is null or duration_minutes between 5 and 1440),
  constraint tenant_services_price_check check (price_cents is null or price_cents >= 0)
);

create index if not exists tenant_services_tenant_sort_idx
  on public.tenant_services(tenant_id, sort_order, created_at);

create table if not exists public.tenant_faqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_faqs_question_check check (length(trim(question)) between 1 and 500),
  constraint tenant_faqs_answer_check check (length(trim(answer)) between 1 and 5000)
);

create index if not exists tenant_faqs_tenant_sort_idx
  on public.tenant_faqs(tenant_id, sort_order, created_at);

create table if not exists public.tenant_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exception_date date not null,
  is_closed boolean not null default true,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_schedule_exceptions_unique unique (tenant_id, exception_date),
  constraint tenant_schedule_exceptions_time_check check (
    is_closed or (start_time is not null and end_time is not null and start_time < end_time)
  )
);

alter table public.tenant_business_profiles enable row level security;
alter table public.tenant_services enable row level security;
alter table public.tenant_faqs enable row level security;
alter table public.tenant_schedule_exceptions enable row level security;

-- Business profile policies.
drop policy if exists "Tenant users can view own business profile" on public.tenant_business_profiles;
create policy "Tenant users can view own business profile"
on public.tenant_business_profiles for select to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can insert own business profile" on public.tenant_business_profiles;
create policy "Tenant users can insert own business profile"
on public.tenant_business_profiles for insert to authenticated
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can update own business profile" on public.tenant_business_profiles;
create policy "Tenant users can update own business profile"
on public.tenant_business_profiles for update to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id))
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can delete own business profile" on public.tenant_business_profiles;
create policy "Tenant users can delete own business profile"
on public.tenant_business_profiles for delete to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Reusable tenant-scoped CRUD policies for services, FAQs and schedule exceptions.
drop policy if exists "Tenant users can view own services" on public.tenant_services;
create policy "Tenant users can view own services"
on public.tenant_services for select to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can insert own services" on public.tenant_services;
create policy "Tenant users can insert own services"
on public.tenant_services for insert to authenticated
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can update own services" on public.tenant_services;
create policy "Tenant users can update own services"
on public.tenant_services for update to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id))
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can delete own services" on public.tenant_services;
create policy "Tenant users can delete own services"
on public.tenant_services for delete to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can view own faqs" on public.tenant_faqs;
create policy "Tenant users can view own faqs"
on public.tenant_faqs for select to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can insert own faqs" on public.tenant_faqs;
create policy "Tenant users can insert own faqs"
on public.tenant_faqs for insert to authenticated
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can update own faqs" on public.tenant_faqs;
create policy "Tenant users can update own faqs"
on public.tenant_faqs for update to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id))
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can delete own faqs" on public.tenant_faqs;
create policy "Tenant users can delete own faqs"
on public.tenant_faqs for delete to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

drop policy if exists "Tenant users can view own schedule exceptions" on public.tenant_schedule_exceptions;
create policy "Tenant users can view own schedule exceptions"
on public.tenant_schedule_exceptions for select to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can insert own schedule exceptions" on public.tenant_schedule_exceptions;
create policy "Tenant users can insert own schedule exceptions"
on public.tenant_schedule_exceptions for insert to authenticated
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can update own schedule exceptions" on public.tenant_schedule_exceptions;
create policy "Tenant users can update own schedule exceptions"
on public.tenant_schedule_exceptions for update to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id))
with check (public.user_belongs_to_tenant(auth.uid(), tenant_id));
drop policy if exists "Tenant users can delete own schedule exceptions" on public.tenant_schedule_exceptions;
create policy "Tenant users can delete own schedule exceptions"
on public.tenant_schedule_exceptions for delete to authenticated
using (public.user_belongs_to_tenant(auth.uid(), tenant_id));

grant select, insert, update, delete on public.tenant_business_profiles to authenticated;
grant select, insert, update, delete on public.tenant_services to authenticated;
grant select, insert, update, delete on public.tenant_faqs to authenticated;
grant select, insert, update, delete on public.tenant_schedule_exceptions to authenticated;
