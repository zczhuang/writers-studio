-- Writer's Studio private, anonymous-device cloud history.
-- Apply only to the dedicated Supabase project after anonymous auth is enabled.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists writers_private;

revoke all on schema writers_private from public, anon, authenticated;

create table public.writer_spaces (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  lineage_id uuid not null unique,
  generation uuid not null unique,
  head_version bigint not null default 0 check (head_version >= 0),
  current_payload jsonb,
  current_payload_hash text,
  current_snapshot_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (current_payload_hash is null or current_payload_hash ~ '^[0-9a-f]{64}$')
);

create table public.writer_space_memberships (
  space_id uuid not null references public.writer_spaces(id),
  user_id uuid not null,
  joined_via text not null check (joined_via in ('created', 'recovery')),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (space_id, user_id)
);

create index writer_space_memberships_user_idx
  on public.writer_space_memberships(user_id, space_id);

create table public.writer_snapshots (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  space_id uuid not null references public.writer_spaces(id),
  operation_id uuid not null,
  actor_user_id uuid not null,
  base_version bigint not null check (base_version >= 0),
  accepted_version bigint,
  disposition text not null check (disposition in ('initial', 'accepted', 'conflict')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (space_id, operation_id),
  check (
    (disposition in ('initial', 'accepted') and accepted_version is not null)
    or (disposition = 'conflict' and accepted_version is null)
  )
);

create unique index writer_snapshots_accepted_version_idx
  on public.writer_snapshots(space_id, accepted_version)
  where accepted_version is not null;

alter table public.writer_spaces
  add constraint writer_spaces_current_snapshot_fk
  foreign key (current_snapshot_id) references public.writer_snapshots(id);

create table public.writer_entry_versions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  space_id uuid not null references public.writer_spaces(id),
  entry_id text not null check (pg_catalog.length(entry_id) between 1 and 256),
  version_id text not null check (pg_catalog.length(version_id) between 1 and 512),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  version_payload jsonb not null,
  originating_snapshot_id uuid not null references public.writer_snapshots(id),
  created_at timestamptz not null default pg_catalog.now(),
  -- Exact archive variants dedupe, but a reused canonical ID with different
  -- content remains recoverable for deterministic client-side conflict merges.
  unique (space_id, entry_id, version_id, content_hash)
);

create index writer_entry_versions_lookup_idx
  on public.writer_entry_versions(space_id, entry_id, created_at);

create table public.writer_progress_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  space_id uuid not null references public.writer_spaces(id),
  event_id text not null check (pg_catalog.length(event_id) between 1 and 512),
  baseline_id text not null check (pg_catalog.length(baseline_id) between 1 and 512),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  event_payload jsonb not null,
  originating_snapshot_id uuid not null references public.writer_snapshots(id),
  created_at timestamptz not null default pg_catalog.now(),
  unique (space_id, event_id, content_hash)
);

create table public.writer_legacy_baselines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  space_id uuid not null references public.writer_spaces(id),
  baseline_id text not null check (pg_catalog.length(baseline_id) between 1 and 512),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  baseline_payload jsonb not null,
  originating_snapshot_id uuid not null references public.writer_snapshots(id),
  created_at timestamptz not null default pg_catalog.now(),
  unique (space_id, baseline_id, content_hash)
);

create table writers_private.recovery_secrets (
  space_id uuid primary key references public.writer_spaces(id),
  recovery_hash bytea not null unique,
  created_at timestamptz not null default pg_catalog.now()
);

create table writers_private.recovery_claim_limits (
  user_id uuid primary key,
  window_started_at timestamptz not null,
  failures integer not null default 0 check (failures >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default pg_catalog.now()
);

create table writers_private.sync_operations (
  space_id uuid not null references public.writer_spaces(id),
  operation_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (space_id, operation_id)
);

alter table public.writer_spaces enable row level security;
alter table public.writer_space_memberships enable row level security;
alter table public.writer_snapshots enable row level security;
alter table public.writer_entry_versions enable row level security;
alter table public.writer_progress_events enable row level security;
alter table public.writer_legacy_baselines enable row level security;

create policy writer_spaces_member_read
  on public.writer_spaces for select to authenticated
  using (
    exists (
      select 1
      from public.writer_space_memberships membership
      where membership.space_id = writer_spaces.id
        and membership.user_id = (select auth.uid())
    )
  );

create policy writer_memberships_self_read
  on public.writer_space_memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy writer_snapshots_member_read
  on public.writer_snapshots for select to authenticated
  using (
    exists (
      select 1
      from public.writer_space_memberships membership
      where membership.space_id = writer_snapshots.space_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy writer_entry_versions_member_read
  on public.writer_entry_versions for select to authenticated
  using (
    exists (
      select 1
      from public.writer_space_memberships membership
      where membership.space_id = writer_entry_versions.space_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy writer_progress_events_member_read
  on public.writer_progress_events for select to authenticated
  using (
    exists (
      select 1
      from public.writer_space_memberships membership
      where membership.space_id = writer_progress_events.space_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy writer_legacy_baselines_member_read
  on public.writer_legacy_baselines for select to authenticated
  using (
    exists (
      select 1
      from public.writer_space_memberships membership
      where membership.space_id = writer_legacy_baselines.space_id
        and membership.user_id = (select auth.uid())
    )
  );

revoke all on table public.writer_spaces from public, anon, authenticated;
revoke all on table public.writer_space_memberships from public, anon, authenticated;
revoke all on table public.writer_snapshots from public, anon, authenticated;
revoke all on table public.writer_entry_versions from public, anon, authenticated;
revoke all on table public.writer_progress_events from public, anon, authenticated;
revoke all on table public.writer_legacy_baselines from public, anon, authenticated;
revoke all on all tables in schema writers_private from public, anon, authenticated;

grant select on table public.writer_spaces to authenticated;
grant select on table public.writer_space_memberships to authenticated;
grant select on table public.writer_snapshots to authenticated;
grant select on table public.writer_entry_versions to authenticated;
grant select on table public.writer_progress_events to authenticated;
grant select on table public.writer_legacy_baselines to authenticated;

create or replace function writers_private.reject_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'writer history is append-only';
end;
$$;

create trigger writer_snapshots_immutable
  before update or delete on public.writer_snapshots
  for each row execute function writers_private.reject_history_mutation();
create trigger writer_entry_versions_immutable
  before update or delete on public.writer_entry_versions
  for each row execute function writers_private.reject_history_mutation();
create trigger writer_progress_events_immutable
  before update or delete on public.writer_progress_events
  for each row execute function writers_private.reject_history_mutation();
create trigger writer_legacy_baselines_immutable
  before update or delete on public.writer_legacy_baselines
  for each row execute function writers_private.reject_history_mutation();

create or replace function writers_private.jsonb_contains_forbidden_field(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  field_name text;
  normalized_name text;
  child jsonb;
begin
  if p_value is null then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(p_value) = 'object' then
    for field_name, child in
      select key, value from pg_catalog.jsonb_each(p_value)
    loop
      normalized_name := pg_catalog.lower(pg_catalog.regexp_replace(field_name, '[_-]', '', 'g'));
      if normalized_name = any (array[
        'auth', 'session', 'accesstoken', 'refreshtoken', 'idtoken', 'bearertoken',
        'authorization', 'credential', 'credentials', 'password', 'passwd', 'token',
        'apikey', 'geminiapikey', 'recoverycode', 'recoveryhash', 'secret', 'secrets',
        'privatekey', 'parentpinhash', 'parentpinsalt', 'screen', 'navstack',
        'currentmode', 'currentchallengeid', 'lastjudge', 'lastentryid',
        'revisingentryid', 'parentunlockeduntil', 'parentgatetarget', 'navigation',
        'unlockstate'
      ]::text[]) then
        return true;
      end if;
      if writers_private.jsonb_contains_forbidden_field(child) then
        return true;
      end if;
    end loop;
  elsif pg_catalog.jsonb_typeof(p_value) = 'array' then
    for child in select value from pg_catalog.jsonb_array_elements(p_value)
    loop
      if writers_private.jsonb_contains_forbidden_field(child) then
        return true;
      end if;
    end loop;
  end if;
  return false;
end;
$$;

create or replace function writers_private.entry_version_is_safe(
  p_value jsonb,
  p_expected_entry_id text default null,
  p_expected_version_id text default null
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  revision_value numeric;
  word_count_value numeric;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;
  if not (p_value ?& array[
    'id', 'entryId', 'parentVersionId', 'revision', 'kind', 'createdAt', 'text',
    'wordCount', 'judge', 'gradingComplete', 'xpDelta'
  ]) then
    return false;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_value) as keys(key_name)
    where not (key_name = any (array[
      'id', 'entryId', 'parentVersionId', 'revision', 'kind', 'createdAt', 'text',
      'wordCount', 'judge', 'gradingComplete', 'xpDelta'
    ]::text[]))
  ) then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_value -> 'id') <> 'string'
     or pg_catalog.length(p_value ->> 'id') not between 1 and 512
     or pg_catalog.jsonb_typeof(p_value -> 'entryId') <> 'string'
     or pg_catalog.length(p_value ->> 'entryId') not between 1 and 256
     or (p_expected_entry_id is not null and p_value ->> 'entryId' is distinct from p_expected_entry_id)
     or (p_expected_version_id is not null and p_value ->> 'id' is distinct from p_expected_version_id)
     or pg_catalog.jsonb_typeof(p_value -> 'revision') <> 'number'
     or pg_catalog.jsonb_typeof(p_value -> 'kind') <> 'string'
     or p_value ->> 'kind' not in ('first-draft', 'revision', 'legacy-current', 'conflict')
     or pg_catalog.jsonb_typeof(p_value -> 'createdAt') <> 'number'
     or pg_catalog.jsonb_typeof(p_value -> 'text') <> 'string'
     or pg_catalog.jsonb_typeof(p_value -> 'wordCount') <> 'number'
     or pg_catalog.jsonb_typeof(p_value -> 'judge') <> 'object'
     or pg_catalog.jsonb_typeof(p_value -> 'gradingComplete') <> 'boolean'
     or pg_catalog.jsonb_typeof(p_value -> 'xpDelta') <> 'number' then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_value -> 'parentVersionId') not in ('null', 'string') then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_value -> 'parentVersionId') = 'string'
     and pg_catalog.length(p_value ->> 'parentVersionId') not between 1 and 512 then
    return false;
  end if;

  revision_value := (p_value ->> 'revision')::numeric;
  word_count_value := (p_value ->> 'wordCount')::numeric;
  if revision_value < 0 or revision_value <> pg_catalog.trunc(revision_value)
     or word_count_value < 0 or word_count_value <> pg_catalog.trunc(word_count_value) then
    return false;
  end if;
  if writers_private.jsonb_contains_forbidden_field(p_value) then
    return false;
  end if;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.payload_is_safe(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  nested_version jsonb;
  entry_id text;
  nested_version_count integer := 0;
  baseline_value jsonb;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or pg_catalog.pg_column_size(p_payload) > 20971520 then
    return false;
  end if;
  if not (p_payload ?& array[
    'version', 'writer', 'earnings', 'entries', 'memory', 'craft', 'settings', 'progress'
  ]) then
    return false;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_payload) as keys(key_name)
    where not (key_name = any (array[
      'version', 'writer', 'earnings', 'entries', 'memory', 'craft', 'settings', 'progress'
    ]::text[]))
  ) then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_payload -> 'version') <> 'number'
     or (p_payload ->> 'version')::numeric is distinct from 4::numeric
     or pg_catalog.jsonb_typeof(p_payload -> 'writer') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'earnings') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'entries') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload -> 'memory') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'craft') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'settings') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'progress') <> 'object' then
    return false;
  end if;
  if writers_private.jsonb_contains_forbidden_field(p_payload) then
    return false;
  end if;

  if not ((p_payload -> 'settings') ?& array[
    'geminiModel', 'dailyCapDollars', 'capBehavior', 'audienceAge'
  ]) or exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_payload -> 'settings') as keys(key_name)
    where not (key_name = any (array[
      'geminiModel', 'dailyCapDollars', 'capBehavior', 'audienceAge'
    ]::text[]))
  ) then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_payload #> '{settings,geminiModel}') <> 'string'
     or pg_catalog.length(p_payload #>> '{settings,geminiModel}') not between 1 and 256
     or pg_catalog.jsonb_typeof(p_payload #> '{settings,dailyCapDollars}') <> 'number'
     or pg_catalog.jsonb_typeof(p_payload #> '{settings,capBehavior}') <> 'string'
     or p_payload #>> '{settings,capBehavior}' not in ('lock', 'forfeit')
     or pg_catalog.jsonb_typeof(p_payload #> '{settings,audienceAge}') <> 'number' then
    return false;
  end if;

  if not ((p_payload -> 'writer') ?& array[
    'xp', 'totalWords', 'totalChallenges', 'bestStreak', 'maxScore'
  ]) or exists (
    select 1
    from unnest(array['xp', 'totalWords', 'totalChallenges', 'bestStreak', 'maxScore']) as counters(counter_name)
    where pg_catalog.jsonb_typeof(p_payload #> array['writer', counter_name]) <> 'number'
  ) then
    return false;
  end if;
  if not ((p_payload -> 'writer') ?& array['modesPlayed', 'achievements', 'activeQuests'])
     or pg_catalog.jsonb_typeof(p_payload #> '{writer,modesPlayed}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{writer,achievements}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{writer,activeQuests}') <> 'array' then
    return false;
  end if;
  if not ((p_payload -> 'earnings') ?& array['ledger', 'lifetimePaid', 'lifetimePending'])
     or pg_catalog.jsonb_typeof(p_payload #> '{earnings,ledger}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{earnings,lifetimePaid}') <> 'number'
     or pg_catalog.jsonb_typeof(p_payload #> '{earnings,lifetimePending}') <> 'number'
     or pg_catalog.jsonb_array_length(p_payload -> 'entries') > 10000
     or pg_catalog.jsonb_array_length(p_payload #> '{earnings,ledger}') > 20000 then
    return false;
  end if;
  if not ((p_payload -> 'craft') ?& array['practicedSkills', 'masteredSkills'])
     or pg_catalog.jsonb_typeof(p_payload #> '{craft,practicedSkills}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{craft,masteredSkills}') <> 'array' then
    return false;
  end if;
  if not ((p_payload -> 'memory') ?& array[
    'mastery', 'piecesByMode', 'growthTargetByMode', 'vocabularyVault', 'recentlyShownSkills'
  ]) or pg_catalog.jsonb_typeof(p_payload #> '{memory,mastery}') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload #> '{memory,piecesByMode}') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload #> '{memory,growthTargetByMode}') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload #> '{memory,vocabularyVault}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{memory,recentlyShownSkills}') <> 'array' then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload -> 'entries') as rows(value)
    group by value ->> 'id'
    having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_payload -> 'entries')
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
       or not (item ? 'id')
       or pg_catalog.jsonb_typeof(item -> 'id') is distinct from 'string'
       or pg_catalog.length(item ->> 'id') not between 1 and 256 then
      return false;
    end if;
    entry_id := item ->> 'id';
    if item ? 'currentVersionId' and (
      pg_catalog.jsonb_typeof(item -> 'currentVersionId') <> 'string'
      or pg_catalog.length(item ->> 'currentVersionId') not between 1 and 512
    ) then
      return false;
    end if;
    if item ? 'versions' then
      if pg_catalog.jsonb_typeof(item -> 'versions') <> 'array' then
        return false;
      end if;
      nested_version_count := nested_version_count + pg_catalog.jsonb_array_length(item -> 'versions');
      if nested_version_count > 50000 or exists (
        select 1
        from pg_catalog.jsonb_array_elements(item -> 'versions') as rows(value)
        group by value ->> 'id'
        having pg_catalog.count(*) > 1
      ) then
        return false;
      end if;
      for nested_version in select value from pg_catalog.jsonb_array_elements(item -> 'versions')
      loop
        if not writers_private.entry_version_is_safe(nested_version, entry_id, null) then
          return false;
        end if;
      end loop;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload #> '{earnings,ledger}') as rows(value)
    group by value ->> 'id'
    having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_payload #> '{earnings,ledger}')
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
       or not (item ?& array['id', 'entryId', 'amount', 'tier', 'status', 'createdAt'])
       or pg_catalog.jsonb_typeof(item -> 'id') <> 'string'
       or pg_catalog.length(item ->> 'id') not between 1 and 512
       or pg_catalog.jsonb_typeof(item -> 'entryId') <> 'string'
       or pg_catalog.length(item ->> 'entryId') not between 1 and 256
       or pg_catalog.jsonb_typeof(item -> 'amount') <> 'number'
       or pg_catalog.jsonb_typeof(item -> 'tier') <> 'string'
       or pg_catalog.jsonb_typeof(item -> 'status') <> 'string'
       or item ->> 'status' not in ('pending', 'paid', 'forfeited')
       or pg_catalog.jsonb_typeof(item -> 'createdAt') <> 'number' then
      return false;
    end if;
    if item ? 'paidAt' and pg_catalog.jsonb_typeof(item -> 'paidAt') <> 'number' then
      return false;
    end if;
    if item ? 'paidNote' and pg_catalog.jsonb_typeof(item -> 'paidNote') <> 'string' then
      return false;
    end if;
  end loop;

  if not ((p_payload -> 'progress') ?& array[
    'lineageId', 'generation', 'baseline', 'baselineConflicts', 'operations', 'updatedAt'
  ]) or pg_catalog.jsonb_typeof(p_payload #> '{progress,lineageId}') <> 'string'
     or pg_catalog.length(p_payload #>> '{progress,lineageId}') not between 1 and 64
     or pg_catalog.jsonb_typeof(p_payload #> '{progress,generation}') <> 'string'
     or pg_catalog.length(p_payload #>> '{progress,generation}') not between 1 and 64
     or pg_catalog.jsonb_typeof(p_payload #> '{progress,baseline}') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload #> '{progress,baselineConflicts}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{progress,operations}') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload #> '{progress,updatedAt}') <> 'number'
     or pg_catalog.jsonb_array_length(p_payload #> '{progress,baselineConflicts}') > 10000
     or pg_catalog.jsonb_array_length(p_payload #> '{progress,operations}') > 50000 then
    return false;
  end if;

  if exists (
    with all_baselines(value) as (
      select p_payload #> '{progress,baseline}'
      union all
      select value from pg_catalog.jsonb_array_elements(p_payload #> '{progress,baselineConflicts}')
    )
    select 1 from all_baselines group by value ->> 'id' having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;
  for baseline_value in
    select p_payload #> '{progress,baseline}'
    union all
    select value from pg_catalog.jsonb_array_elements(p_payload #> '{progress,baselineConflicts}')
  loop
    if pg_catalog.jsonb_typeof(baseline_value) <> 'object'
       or not (baseline_value ?& array[
         'id', 'createdAt', 'provenance', 'fingerprint', 'xp', 'totalWords', 'totalChallenges'
       ])
       or pg_catalog.jsonb_typeof(baseline_value -> 'id') <> 'string'
       or pg_catalog.length(baseline_value ->> 'id') not between 1 and 512
       or pg_catalog.jsonb_typeof(baseline_value -> 'createdAt') <> 'number'
       or pg_catalog.jsonb_typeof(baseline_value -> 'provenance') <> 'string'
       or pg_catalog.jsonb_typeof(baseline_value -> 'fingerprint') <> 'string'
       or pg_catalog.jsonb_typeof(baseline_value -> 'xp') <> 'number'
       or pg_catalog.jsonb_typeof(baseline_value -> 'totalWords') <> 'number'
       or pg_catalog.jsonb_typeof(baseline_value -> 'totalChallenges') <> 'number' then
      return false;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload #> '{progress,operations}') as rows(value)
    group by value ->> 'id'
    having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_payload #> '{progress,operations}')
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
       or not (item ?& array[
         'id', 'baselineId', 'kind', 'entryId', 'versionId', 'createdAt', 'xpDelta',
         'totalWordsDelta', 'totalChallengesDelta'
       ])
       or pg_catalog.jsonb_typeof(item -> 'id') <> 'string'
       or pg_catalog.length(item ->> 'id') not between 1 and 512
       or pg_catalog.jsonb_typeof(item -> 'baselineId') <> 'string'
       or pg_catalog.length(item ->> 'baselineId') not between 1 and 512
       or pg_catalog.jsonb_typeof(item -> 'entryId') <> 'string'
       or pg_catalog.length(item ->> 'entryId') not between 1 and 256
       or pg_catalog.jsonb_typeof(item -> 'versionId') <> 'string'
       or pg_catalog.length(item ->> 'versionId') not between 1 and 512
       or pg_catalog.jsonb_typeof(item -> 'kind') <> 'string'
       or item ->> 'kind' not in ('entry-submit', 'entry-revision')
       or pg_catalog.jsonb_typeof(item -> 'createdAt') <> 'number'
       or pg_catalog.jsonb_typeof(item -> 'xpDelta') <> 'number'
       or pg_catalog.jsonb_typeof(item -> 'totalWordsDelta') <> 'number'
       or pg_catalog.jsonb_typeof(item -> 'totalChallengesDelta') <> 'number' then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.entry_version_archive_is_safe(p_entry_versions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  entry_id text;
  version_id text;
begin
  if p_entry_versions is null or pg_catalog.jsonb_typeof(p_entry_versions) <> 'array'
     or pg_catalog.jsonb_array_length(p_entry_versions) > 50000
     or writers_private.jsonb_contains_forbidden_field(p_entry_versions) then
    return false;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_entry_versions) as rows(value)
    group by value ->> 'entry_id', value ->> 'version_id'
    having pg_catalog.count(*) > 1
  ) then
    return false;
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_entry_versions)
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
       or not (item ?& array['entry_id', 'version_id', 'version_payload'])
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(item) as keys(key_name)
         where not (key_name = any (array['entry_id', 'version_id', 'version_payload']::text[]))
       )
       or pg_catalog.jsonb_typeof(item -> 'entry_id') <> 'string'
       or pg_catalog.jsonb_typeof(item -> 'version_id') <> 'string' then
      return false;
    end if;
    entry_id := item ->> 'entry_id';
    version_id := item ->> 'version_id';
    if pg_catalog.length(entry_id) not between 1 and 256
       or pg_catalog.length(version_id) not between 1 and 512
       or not writers_private.entry_version_is_safe(
         item -> 'version_payload', entry_id, version_id
       ) then
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.request_body_within_budget(
  p_payload jsonb,
  p_payload_canonical text,
  p_entry_versions jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  canonical_bytes integer;
  archive_bytes integer;
begin
  if p_payload is null or p_payload_canonical is null or p_entry_versions is null then
    return false;
  end if;
  canonical_bytes := pg_catalog.octet_length(pg_catalog.convert_to(p_payload_canonical, 'UTF8'));
  archive_bytes := pg_catalog.octet_length(pg_catalog.convert_to(p_entry_versions::text, 'UTF8'));
  return canonical_bytes between 1 and 20971520
     and canonical_bytes + archive_bytes <= 20971520
     and pg_catalog.pg_column_size(p_payload) + pg_catalog.pg_column_size(p_entry_versions) <= 20971520;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.canonical_payload_matches(
  p_payload jsonb,
  p_payload_hash text,
  p_payload_canonical text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_payload jsonb;
  calculated_hash text;
begin
  if p_payload is null or p_payload_hash is null or p_payload_canonical is null
     or p_payload_hash !~ '^[0-9a-f]{64}$'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_payload_canonical, 'UTF8')) not between 1 and 20971520 then
    return false;
  end if;
  begin
    parsed_payload := p_payload_canonical::jsonb;
  exception when others then
    return false;
  end;
  if parsed_payload is distinct from p_payload then
    return false;
  end if;
  calculated_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_payload_canonical, 'UTF8'), 'sha256'),
    'hex'
  );
  return calculated_hash is not distinct from p_payload_hash;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.payload_is_meaningful(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return
    pg_catalog.jsonb_array_length(p_payload -> 'entries') > 0
    or pg_catalog.jsonb_array_length(p_payload #> '{earnings,ledger}') > 0
    or coalesce((p_payload #>> '{writer,xp}')::numeric, 0) > 0
    or coalesce((p_payload #>> '{writer,totalWords}')::numeric, 0) > 0
    or coalesce((p_payload #>> '{writer,totalChallenges}')::numeric, 0) > 0
    or pg_catalog.jsonb_array_length(coalesce(p_payload #> '{craft,practicedSkills}', '[]'::jsonb)) > 0
    or pg_catalog.jsonb_array_length(coalesce(p_payload #> '{craft,masteredSkills}', '[]'::jsonb)) > 0;
exception when others then
  return false;
end;
$$;

create or replace function writers_private.member_can_access(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.writer_space_memberships membership
    where membership.space_id = p_space_id
      and membership.user_id = p_user_id
  )
$$;

create or replace function writers_private.validate_head_replacement(p_current jsonb, p_candidate jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  counter_name text;
begin
  if not writers_private.payload_is_safe(p_candidate) then
    return 'unsafe_payload';
  end if;
  if writers_private.payload_is_meaningful(p_current) and not writers_private.payload_is_meaningful(p_candidate) then
    return 'empty_rejected';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(p_current -> 'entries', '[]'::jsonb)) old_entry
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(p_candidate -> 'entries', '[]'::jsonb)) new_entry
      where new_entry ->> 'id' = old_entry ->> 'id'
    )
  ) then
    return 'entry_loss';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(p_current #> '{earnings,ledger}', '[]'::jsonb)) old_ledger
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(coalesce(p_candidate #> '{earnings,ledger}', '[]'::jsonb)) new_ledger
      where new_ledger ->> 'id' = old_ledger ->> 'id'
    )
  ) then
    return 'ledger_loss';
  end if;

  for old_row in
    select value
    from pg_catalog.jsonb_array_elements(coalesce(p_current #> '{earnings,ledger}', '[]'::jsonb))
    where value ->> 'status' in ('paid', 'forfeited')
  loop
    select value into new_row
    from pg_catalog.jsonb_array_elements(coalesce(p_candidate #> '{earnings,ledger}', '[]'::jsonb))
    where value ->> 'id' = old_row ->> 'id'
    limit 1;
    if new_row is null or new_row is distinct from old_row then
      return 'terminal_ledger_changed';
    end if;
  end loop;

  foreach counter_name in array array['xp', 'totalWords', 'totalChallenges', 'bestStreak', 'maxScore']
  loop
    if coalesce((p_candidate #>> array['writer', counter_name])::numeric, 0)
       < coalesce((p_current #>> array['writer', counter_name])::numeric, 0) then
      return 'counter_regression';
    end if;
  end loop;
  return null;
exception when invalid_text_representation or numeric_value_out_of_range then
  return 'invalid_counter';
end;
$$;

create or replace function writers_private.record_payload_history(
  p_space_id uuid,
  p_snapshot_id uuid,
  p_payload jsonb,
  p_entry_versions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  history_version_payload jsonb;
  history_entry_id text;
  history_version_id text;
  baseline_payload jsonb;
  history_content_hash text;
begin
  if not writers_private.payload_is_safe(p_payload)
     or not writers_private.entry_version_archive_is_safe(p_entry_versions) then
    raise exception 'invalid entry version archive';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_entry_versions)
  loop
    history_entry_id := item ->> 'entry_id';
    history_version_id := item ->> 'version_id';
    history_version_payload := item -> 'version_payload';
    if history_entry_id is null or history_version_id is null or history_version_payload is null
       or pg_catalog.length(history_entry_id) > 256 or pg_catalog.length(history_version_id) > 512 then
      raise exception 'invalid entry version';
    end if;
    history_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(history_version_payload::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.writer_entry_versions (
      space_id, entry_id, version_id, content_hash, version_payload, originating_snapshot_id
    ) values (
      p_space_id, history_entry_id, history_version_id, history_content_hash, history_version_payload, p_snapshot_id
    ) on conflict (space_id, entry_id, version_id, content_hash) do nothing;
  end loop;

  -- Defense in depth: even a client that omits explicit versions archives each current entry.
  for item in select value from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'entries', '[]'::jsonb))
  loop
    history_entry_id := item ->> 'id';
    if history_entry_id is null or pg_catalog.length(history_entry_id) > 256 then
      raise exception 'invalid entry';
    end if;
    history_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(item::text, 'UTF8'), 'sha256'), 'hex');
    history_version_id := coalesce(item ->> 'currentVersionId', 'current-' || history_content_hash);
    insert into public.writer_entry_versions (
      space_id, entry_id, version_id, content_hash, version_payload, originating_snapshot_id
    ) values (
      p_space_id, history_entry_id, history_version_id, history_content_hash, item, p_snapshot_id
    ) on conflict (space_id, entry_id, version_id, content_hash) do nothing;
  end loop;

  baseline_payload := p_payload #> '{progress,baseline}';
  if baseline_payload is not null and baseline_payload ->> 'id' is not null then
    history_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(baseline_payload::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.writer_legacy_baselines (
      space_id, baseline_id, content_hash, baseline_payload, originating_snapshot_id
    ) values (
      p_space_id, baseline_payload ->> 'id', history_content_hash, baseline_payload, p_snapshot_id
    ) on conflict (space_id, baseline_id, content_hash) do nothing;
  end if;
  for baseline_payload in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_payload #> '{progress,baselineConflicts}', '[]'::jsonb))
  loop
    if baseline_payload ->> 'id' is not null then
      history_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(baseline_payload::text, 'UTF8'), 'sha256'), 'hex');
      insert into public.writer_legacy_baselines (
        space_id, baseline_id, content_hash, baseline_payload, originating_snapshot_id
      ) values (
        p_space_id, baseline_payload ->> 'id', history_content_hash, baseline_payload, p_snapshot_id
      ) on conflict (space_id, baseline_id, content_hash) do nothing;
    end if;
  end loop;

  for item in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_payload #> '{progress,operations}', '[]'::jsonb))
  loop
    if item ->> 'id' is null or item ->> 'baselineId' is null then
      raise exception 'invalid progress event';
    end if;
    history_content_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(item::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.writer_progress_events (
      space_id, event_id, baseline_id, content_hash, event_payload, originating_snapshot_id
    ) values (
      p_space_id, item ->> 'id', item ->> 'baselineId', history_content_hash, item, p_snapshot_id
    ) on conflict (space_id, event_id, content_hash) do nothing;
  end loop;
end;
$$;

create or replace function public.get_writer_space_state(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  space_row public.writer_spaces%rowtype;
begin
  if caller is null then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if not writers_private.member_can_access(p_space_id, caller) then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  select * into space_row from public.writer_spaces where id = p_space_id;
  if not found then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'space_id', space_row.id,
    'generation', space_row.generation,
    'version', space_row.head_version,
    'payload', space_row.current_payload,
    'payload_hash', space_row.current_payload_hash,
    'updated_at', space_row.updated_at
  );
end;
$$;

create or replace function public.create_writer_space(
  p_lineage_id uuid,
  p_generation uuid,
  p_recovery_code text,
  p_operation_id uuid,
  p_payload jsonb,
  p_payload_hash text,
  p_entry_versions jsonb default '[]'::jsonb,
  p_payload_canonical text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  space_row public.writer_spaces%rowtype;
  snapshot_id uuid := pg_catalog.gen_random_uuid();
  request_hash text;
  recovery_hash_value bytea;
  recovery_hash_hex text;
  stored_recovery_hash bytea;
  recovery_space_id uuid;
  prior_op writers_private.sync_operations%rowtype;
  result jsonb;
  existing_space boolean := false;
  inserted_space boolean := false;
  now_at timestamptz;
begin
  if caller is null then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if p_lineage_id is null or p_generation is null or p_operation_id is null
     or p_payload is null or p_recovery_code is null or p_payload_hash is null
     or p_entry_versions is null or p_payload_canonical is null
     or p_recovery_code !~ '^[A-Za-z0-9_-]{43}$'
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  -- A known lineage is authorization-sensitive. Reject nonmembers before doing
  -- canonical parsing, hashing, or archive validation, and never let metadata
  -- alone turn an existing row into a newly claimed space.
  select * into space_row
  from public.writer_spaces
  where lineage_id = p_lineage_id;
  if found then
    existing_space := true;
    if space_row.generation is distinct from p_generation
       or not writers_private.member_can_access(space_row.id, caller) then
      return pg_catalog.jsonb_build_object('status', 'forbidden');
    end if;
  end if;

  if not writers_private.request_body_within_budget(
       p_payload, p_payload_canonical, p_entry_versions
     )
     or not writers_private.canonical_payload_matches(
       p_payload, p_payload_hash, p_payload_canonical
     )
     or not writers_private.payload_is_safe(p_payload)
     or not writers_private.entry_version_archive_is_safe(p_entry_versions) then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;
  if not writers_private.payload_is_meaningful(p_payload) then
    return pg_catalog.jsonb_build_object('status', 'empty_rejected');
  end if;
  if p_payload #>> '{progress,lineageId}' is distinct from p_lineage_id::text
     or p_payload #>> '{progress,generation}' is distinct from p_generation::text then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  recovery_hash_value := extensions.digest(pg_catalog.convert_to(p_recovery_code, 'UTF8'), 'sha256');
  recovery_hash_hex := pg_catalog.encode(recovery_hash_value, 'hex');
  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'kind', 'create',
      'lineage', p_lineage_id,
      'generation', p_generation,
      'operation_id', p_operation_id,
      'recovery_hash', recovery_hash_hex,
      'payload', p_payload,
      'payload_canonical', p_payload_canonical,
      'payload_hash', p_payload_hash,
      'entry_versions', p_entry_versions
    )::text, 'UTF8'), 'sha256'), 'hex');

  if existing_space then
    select * into space_row
    from public.writer_spaces
    where id = space_row.id
    for update;
    if not found or space_row.generation is distinct from p_generation
       or not writers_private.member_can_access(space_row.id, caller) then
      return pg_catalog.jsonb_build_object('status', 'forbidden');
    end if;
  else
    -- Serialize the vanishingly unlikely recovery-hash collision before any
    -- persistent row is created. A concurrent identical creator may have
    -- committed while this request waited, so re-check its lineage and
    -- membership instead of treating the now-present hash as a collision.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(recovery_hash_hex, 0));
    select secret.space_id into recovery_space_id
    from writers_private.recovery_secrets secret
    where secret.recovery_hash = recovery_hash_value;
    if found then
      select * into space_row
      from public.writer_spaces
      where id = recovery_space_id
      for update;
      if not found
         or space_row.lineage_id is distinct from p_lineage_id
         or space_row.generation is distinct from p_generation then
        return pg_catalog.jsonb_build_object('status', 'invalid');
      end if;
      if not writers_private.member_can_access(space_row.id, caller) then
        return pg_catalog.jsonb_build_object('status', 'forbidden');
      end if;
      existing_space := true;
    else
      insert into public.writer_spaces (lineage_id, generation)
      values (p_lineage_id, p_generation)
      on conflict do nothing
      returning * into space_row;
      inserted_space := found;
      if not inserted_space then
        select * into space_row
        from public.writer_spaces
        where lineage_id = p_lineage_id
        for update;
        if not found or space_row.generation is distinct from p_generation
           or not writers_private.member_can_access(space_row.id, caller) then
          return pg_catalog.jsonb_build_object('status', 'forbidden');
        end if;
        existing_space := true;
      else
        insert into public.writer_space_memberships (space_id, user_id, joined_via)
        values (space_row.id, caller, 'created');
        insert into writers_private.recovery_secrets (space_id, recovery_hash)
        values (space_row.id, recovery_hash_value);
      end if;
    end if;
  end if;

  select secret.recovery_hash into stored_recovery_hash
  from writers_private.recovery_secrets secret
  where secret.space_id = space_row.id;
  if not found or stored_recovery_hash is distinct from recovery_hash_value then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select * into prior_op
  from writers_private.sync_operations
  where space_id = space_row.id and operation_id = p_operation_id;
  if found then
    if prior_op.request_hash is distinct from request_hash then
      return pg_catalog.jsonb_build_object('status', 'invalid');
    end if;
    return prior_op.result;
  end if;

  if existing_space then
    if space_row.head_version <= 0 then
      return pg_catalog.jsonb_build_object('status', 'forbidden');
    end if;
    result := pg_catalog.jsonb_build_object(
      'status', 'ok',
      'space_id', space_row.id,
      'generation', space_row.generation,
      'version', space_row.head_version,
      'payload', space_row.current_payload,
      'payload_hash', space_row.current_payload_hash,
      'updated_at', space_row.updated_at
    );
    insert into writers_private.sync_operations (space_id, operation_id, request_hash, result)
    values (space_row.id, p_operation_id, request_hash, result);
    return result;
  end if;
  if not inserted_space or not writers_private.member_can_access(space_row.id, caller) then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;

  insert into public.writer_snapshots (
    id, space_id, operation_id, actor_user_id, base_version, accepted_version,
    disposition, request_hash, payload_hash, payload
  ) values (
    snapshot_id, space_row.id, p_operation_id, caller, 0, 1,
    'initial', request_hash, p_payload_hash, p_payload
  );
  perform writers_private.record_payload_history(space_row.id, snapshot_id, p_payload, p_entry_versions);

  now_at := pg_catalog.now();
  update public.writer_spaces
  set head_version = 1,
      current_payload = p_payload,
      current_payload_hash = p_payload_hash,
      current_snapshot_id = snapshot_id,
      updated_at = now_at
  where id = space_row.id;

  result := pg_catalog.jsonb_build_object(
    'status', 'ok', 'space_id', space_row.id, 'generation', p_generation,
    'version', 1, 'payload', p_payload, 'payload_hash', p_payload_hash,
    'updated_at', now_at
  );
  insert into writers_private.sync_operations (space_id, operation_id, request_hash, result)
  values (space_row.id, p_operation_id, request_hash, result);
  return result;
end;
$$;

create or replace function public.sync_writer_space(
  p_space_id uuid,
  p_generation uuid,
  p_expected_version bigint,
  p_operation_id uuid,
  p_payload jsonb,
  p_payload_hash text,
  p_entry_versions jsonb default '[]'::jsonb,
  p_payload_canonical text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  space_row public.writer_spaces%rowtype;
  snapshot_id uuid := pg_catalog.gen_random_uuid();
  request_hash text;
  prior_op writers_private.sync_operations%rowtype;
  validation_error text;
  result jsonb;
  next_version bigint;
  now_at timestamptz;
begin
  if caller is null then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if p_space_id is null or p_generation is null or p_expected_version is null or p_operation_id is null
     or p_payload is null or p_payload_hash is null or p_entry_versions is null
     or p_payload_canonical is null or p_expected_version < 0
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;
  if not writers_private.member_can_access(p_space_id, caller) then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;

  select * into space_row
  from public.writer_spaces
  where id = p_space_id;
  if not found or space_row.generation is distinct from p_generation then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if not writers_private.request_body_within_budget(
       p_payload, p_payload_canonical, p_entry_versions
     )
     or not writers_private.canonical_payload_matches(
       p_payload, p_payload_hash, p_payload_canonical
     )
     or not writers_private.payload_is_safe(p_payload)
     or not writers_private.entry_version_archive_is_safe(p_entry_versions) then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;
  if p_payload #>> '{progress,lineageId}' is distinct from space_row.lineage_id::text
     or p_payload #>> '{progress,generation}' is distinct from p_generation::text
     or p_generation is distinct from space_row.generation then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'kind', 'sync',
      'space', p_space_id,
      'generation', p_generation,
      'expected_version', p_expected_version,
      'operation_id', p_operation_id,
      'payload', p_payload,
      'payload_canonical', p_payload_canonical,
      'payload_hash', p_payload_hash,
      'entry_versions', p_entry_versions
    )::text, 'UTF8'), 'sha256'), 'hex');

  select * into space_row from public.writer_spaces where id = p_space_id for update;
  if not found or space_row.generation is distinct from p_generation then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if not writers_private.member_can_access(p_space_id, caller) then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  if p_payload #>> '{progress,lineageId}' is distinct from space_row.lineage_id::text
     or p_payload #>> '{progress,generation}' is distinct from space_row.generation::text then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select * into prior_op
  from writers_private.sync_operations
  where space_id = p_space_id and operation_id = p_operation_id;
  if found then
    if prior_op.request_hash is distinct from request_hash then
      return pg_catalog.jsonb_build_object('status', 'invalid');
    end if;
    return prior_op.result;
  end if;

  if p_expected_version is distinct from space_row.head_version then
    insert into public.writer_snapshots (
      id, space_id, operation_id, actor_user_id, base_version, accepted_version,
      disposition, request_hash, payload_hash, payload
    ) values (
      snapshot_id, p_space_id, p_operation_id, caller, p_expected_version, null,
      'conflict', request_hash, p_payload_hash, p_payload
    );
    perform writers_private.record_payload_history(p_space_id, snapshot_id, p_payload, p_entry_versions);
    result := pg_catalog.jsonb_build_object(
      'status', 'conflict', 'space_id', p_space_id, 'generation', space_row.generation,
      'version', space_row.head_version, 'payload', space_row.current_payload,
      'payload_hash', space_row.current_payload_hash, 'updated_at', space_row.updated_at
    );
    insert into writers_private.sync_operations (space_id, operation_id, request_hash, result)
    values (p_space_id, p_operation_id, request_hash, result);
    return result;
  end if;

  validation_error := writers_private.validate_head_replacement(space_row.current_payload, p_payload);
  if validation_error is not null then
    if validation_error = 'empty_rejected' then
      return pg_catalog.jsonb_build_object('status', 'empty_rejected');
    end if;
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  next_version := space_row.head_version + 1;
  insert into public.writer_snapshots (
    id, space_id, operation_id, actor_user_id, base_version, accepted_version,
    disposition, request_hash, payload_hash, payload
  ) values (
    snapshot_id, p_space_id, p_operation_id, caller, p_expected_version, next_version,
    'accepted', request_hash, p_payload_hash, p_payload
  );
  perform writers_private.record_payload_history(p_space_id, snapshot_id, p_payload, p_entry_versions);
  now_at := pg_catalog.now();
  update public.writer_spaces
  set head_version = next_version,
      current_payload = p_payload,
      current_payload_hash = p_payload_hash,
      current_snapshot_id = snapshot_id,
      updated_at = now_at
  where id = p_space_id;

  result := pg_catalog.jsonb_build_object(
    'status', 'ok', 'space_id', p_space_id, 'generation', p_generation,
    'version', next_version, 'payload_hash', p_payload_hash,
    'updated_at', now_at
  );
  insert into writers_private.sync_operations (space_id, operation_id, request_hash, result)
  values (p_space_id, p_operation_id, request_hash, result);
  return result;
end;
$$;

create or replace function public.claim_writer_space(p_recovery_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  now_at timestamptz := pg_catalog.now();
  limiter writers_private.recovery_claim_limits%rowtype;
  claimed_space_id uuid;
  space_row public.writer_spaces%rowtype;
  next_failures integer;
begin
  if caller is null then return pg_catalog.jsonb_build_object('status', 'forbidden'); end if;

  insert into writers_private.recovery_claim_limits (user_id, window_started_at, failures, updated_at)
  values (caller, now_at, 0, now_at)
  on conflict (user_id) do nothing;
  select * into limiter
  from writers_private.recovery_claim_limits
  where user_id = caller
  for update;

  if limiter.blocked_until is not null and limiter.blocked_until > now_at then
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', pg_catalog.ceil(pg_catalog.date_part('epoch', limiter.blocked_until - now_at))::integer
    );
  end if;
  if limiter.window_started_at < now_at - interval '15 minutes' then
    update writers_private.recovery_claim_limits
    set window_started_at = now_at, failures = 0, blocked_until = null, updated_at = now_at
    where user_id = caller;
    limiter.failures := 0;
  end if;

  if p_recovery_code !~ '^[A-Za-z0-9_-]{43}$' then
    claimed_space_id := null;
  else
    select secret.space_id into claimed_space_id
    from writers_private.recovery_secrets secret
    where secret.recovery_hash = extensions.digest(pg_catalog.convert_to(p_recovery_code, 'UTF8'), 'sha256');
  end if;

  if claimed_space_id is null then
    next_failures := limiter.failures + 1;
    update writers_private.recovery_claim_limits
    set failures = next_failures,
        blocked_until = case when next_failures >= 5 then now_at + interval '15 minutes' else null end,
        updated_at = now_at
    where user_id = caller;
    if next_failures >= 5 then
      return pg_catalog.jsonb_build_object('status', 'rate_limited', 'retry_after_seconds', 900);
    end if;
    -- Expected failure is returned, not raised, so the rate-limit update commits.
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  insert into public.writer_space_memberships (space_id, user_id, joined_via)
  values (claimed_space_id, caller, 'recovery')
  on conflict (space_id, user_id) do nothing;
  if not writers_private.member_can_access(claimed_space_id, caller) then
    return pg_catalog.jsonb_build_object('status', 'forbidden');
  end if;
  update writers_private.recovery_claim_limits
  set window_started_at = now_at, failures = 0, blocked_until = null, updated_at = now_at
  where user_id = caller;

  select * into space_row from public.writer_spaces where id = claimed_space_id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok', 'space_id', space_row.id, 'generation', space_row.generation,
    'version', space_row.head_version, 'payload', space_row.current_payload,
    'payload_hash', space_row.current_payload_hash, 'updated_at', space_row.updated_at
  );
end;
$$;

revoke all on function public.get_writer_space_state(uuid) from public, anon, authenticated;
revoke all on function public.create_writer_space(uuid, uuid, text, uuid, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.sync_writer_space(uuid, uuid, bigint, uuid, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.claim_writer_space(text) from public, anon, authenticated;

grant execute on function public.get_writer_space_state(uuid) to authenticated;
grant execute on function public.create_writer_space(uuid, uuid, text, uuid, jsonb, text, jsonb, text) to authenticated;
grant execute on function public.sync_writer_space(uuid, uuid, bigint, uuid, jsonb, text, jsonb, text) to authenticated;
grant execute on function public.claim_writer_space(text) to authenticated;

revoke all on all functions in schema writers_private from public, anon, authenticated;
