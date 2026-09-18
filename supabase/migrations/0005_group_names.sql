-- Groups get a name the coach sets, so they can be identified at a glance
-- (and linked to) instead of only by level + schedule.
alter table public.lesson_groups add column name text;

with numbered as (
  select id, row_number() over (partition by level order by created_at) as rn
  from public.lesson_groups
)
update public.lesson_groups lg
set name = initcap(lg.level) || ' Group ' || numbered.rn
from numbered
where numbered.id = lg.id and lg.name is null;

alter table public.lesson_groups alter column name set not null;
