alter table public.tags
  add column if not exists sentiment text not null default 'neutral';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tags_sentiment_check'
      and conrelid = 'public.tags'::regclass
  ) then
    alter table public.tags
      add constraint tags_sentiment_check
      check (sentiment in ('positive', 'negative', 'neutral'));
  end if;
end;
$$;

update public.tags
set sentiment = case lower(trim(label))
  when 'would stay again' then 'positive'
  when 'wifi was fast' then 'positive'
  when 'photos matched listing' then 'positive'
  when 'front desk helpful' then 'positive'
  when 'breakfast worth it' then 'positive'
  when 'cleanliness met expectations' then 'positive'
  when 'noise level was an issue' then 'negative'
  when 'hidden fees' then 'negative'
  else 'neutral'
end
where lower(trim(label)) in (
  'would stay again',
  'wifi was fast',
  'photos matched listing',
  'front desk helpful',
  'breakfast worth it',
  'cleanliness met expectations',
  'noise level was an issue',
  'hidden fees'
);
