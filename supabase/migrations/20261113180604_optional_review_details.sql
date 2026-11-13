alter table public.subjects
  alter column source_url drop not null,
  alter column place_type drop not null,
  alter column price_tier drop not null;

alter table public.reviews
  add column if not exists stay_nights integer check (stay_nights is null or stay_nights >= 1),
  add column if not exists nightly_cost numeric(10, 2) check (nightly_cost is null or nightly_cost >= 0),
  add column if not exists monthly_cost numeric(10, 2) check (monthly_cost is null or monthly_cost >= 0);
