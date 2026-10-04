\set ON_ERROR_STOP on
\pset pager off

do $safety$
begin
  if pg_catalog.current_database() is distinct from 'postgres'
     or pg_catalog.current_setting('port') is distinct from '49731'
     or pg_catalog.current_setting('server_version_num')::integer not between 170000 and 179999
     or pg_catalog.current_setting('listen_addresses') is distinct from ''
     or pg_catalog.current_setting('unix_socket_directories') is distinct from '/tmp/writers-studio-cloud-20261003/pg-socket'
     or pg_catalog.current_setting('data_directory') is distinct from '/tmp/writers-studio-cloud-20261003/pg-data'
     or pg_catalog.inet_server_addr() is not null then
    raise exception 'refusing destructive SQL harness reset: not the isolated Writer''s Studio PG17 test server';
  end if;
end;
$safety$;

\echo 'Writer''s Studio SQL harness: reset isolated test data'

drop schema if exists writers_test cascade;

truncate table
  public.writer_space_memberships,
  public.writer_entry_versions,
  public.writer_progress_events,
  public.writer_legacy_baselines,
  writers_private.sync_operations,
  writers_private.recovery_secrets,
  writers_private.recovery_claim_limits,
  public.writer_snapshots,
  public.writer_spaces;

create schema writers_test;
revoke all on schema writers_test from public, anon, authenticated;
grant usage on schema writers_test to authenticated;

create table writers_test.assertion_log (
  id bigint generated always as identity primary key,
  assertion_name text not null
);

create table writers_test.race_observations (
  race_name text primary key,
  observed_waiters integer not null,
  observed_at timestamptz not null default pg_catalog.now()
);

create or replace function writers_test.assert_true(p_condition boolean, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_condition is distinct from true then
    raise exception 'assertion failed: %', p_name;
  end if;
  insert into writers_test.assertion_log (assertion_name) values (p_name);
end;
$$;

create or replace function writers_test.assert_status(p_result jsonb, p_expected text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform writers_test.assert_true(
    p_result ->> 'status' is not distinct from p_expected,
    p_name || ' (expected ' || p_expected || ', got ' || coalesce(p_result ->> 'status', '<null>') || ')'
  );
end;
$$;

create or replace function writers_test.make_judge(p_score numeric)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'score', p_score,
    'tier', 'silver',
    'breakdown', pg_catalog.jsonb_build_object(
      'vocabulary', 8, 'imagery', 8, 'voice', 8, 'structure', 8, 'originality', 8
    ),
    'strengths', pg_catalog.jsonb_build_array('clear'),
    'suggestions', pg_catalog.jsonb_build_array('detail'),
    'celebrate', 'Nice',
    'source', 'heuristic'
  )
$$;

create or replace function writers_test.make_version(p_marker text, p_sequence integer)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', 'version-1',
    'entryId', 'entry-1',
    'parentVersionId', null,
    'revision', 0,
    'kind', 'first-draft',
    'createdAt', 1000 + p_sequence,
    'text', 'Hello 世界 — password appears only in writing text. ' || p_marker,
    'wordCount', 8 + p_sequence,
    'judge', writers_test.make_judge(80),
    'gradingComplete', true,
    'xpDelta', 10
  )
$$;

create or replace function writers_test.make_payload(
  p_marker text,
  p_xp numeric,
  p_sequence integer,
  p_lineage uuid,
  p_generation uuid,
  p_paid_amount numeric
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  version_value jsonb := writers_test.make_version(p_marker, p_sequence);
  judge_value jsonb := writers_test.make_judge(80);
begin
  return pg_catalog.jsonb_build_object(
    'version', 4,
    'writer', pg_catalog.jsonb_build_object(
      'name', 'Writer',
      'xp', p_xp,
      'streak', 1,
      'bestStreak', 1,
      'graceTokens', 0,
      'lastPlayDate', null,
      'totalWords', 8 + p_sequence,
      'totalChallenges', 1,
      'maxScore', 80,
      'modesPlayed', pg_catalog.jsonb_build_array('scene'),
      'achievements', '[]'::jsonb,
      'activeQuests', '[]'::jsonb
    ),
    'earnings', pg_catalog.jsonb_build_object(
      'ledger', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id', 'ledger-1',
        'entryId', 'entry-1',
        'amount', p_paid_amount,
        'tier', 'silver',
        'status', 'paid',
        'createdAt', 1000,
        'paidAt', 1001,
        'paidNote', 'settled'
      )),
      'lifetimePaid', p_paid_amount,
      'lifetimePending', 0
    ),
    'entries', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', 'entry-1',
      'date', '2026-10-03',
      'createdAt', 1000,
      'mode', 'scene',
      'challengeId', 'challenge-1',
      'challengeTitle', 'A scene',
      'prompt', 'Write it',
      'text', version_value ->> 'text',
      'wordCount', 8 + p_sequence,
      'judge', judge_value,
      'earningsId', 'ledger-1',
      'revisionCount', 0,
      'versions', pg_catalog.jsonb_build_array(version_value),
      'currentVersionId', 'version-1',
      'firstDraft', pg_catalog.jsonb_build_object(
        'versionId', 'version-1', 'createdAt', 1000, 'wordCount', 8, 'xpAwarded', 10
      ),
      'gradingComplete', true
    )),
    'memory', pg_catalog.jsonb_build_object(
      'mastery', pg_catalog.jsonb_build_object(
        'vocabulary', 8, 'imagery', 8, 'voice', 8, 'structure', 8, 'originality', 8
      ),
      'sampleCount', 1,
      'piecesByMode', pg_catalog.jsonb_build_object(
        'scene', 1, 'story', 0, 'mystery', 0, 'upgrade', 0
      ),
      'strength', 'voice',
      'growthEdge', 'imagery',
      'growthTargetByMode', pg_catalog.jsonb_build_object('scene', 'imagery'),
      'lastGrowth', null,
      'vocabularyVault', pg_catalog.jsonb_build_array('luminous'),
      'recentlyShownSkills', '[]'::jsonb,
      'lastSkillSource', null,
      'bestScore', 80,
      'updatedAt', 1000 + p_sequence
    ),
    'craft', pg_catalog.jsonb_build_object(
      'practicedSkills', pg_catalog.jsonb_build_array('scene-setting'),
      'masteredSkills', '[]'::jsonb
    ),
    'settings', pg_catalog.jsonb_build_object(
      'geminiModel', 'gemini-2.5-flash',
      'dailyCapDollars', 0.5,
      'capBehavior', 'lock',
      'audienceAge', 10
    ),
    'progress', pg_catalog.jsonb_build_object(
      'lineageId', p_lineage::text,
      'generation', p_generation::text,
      'baseline', pg_catalog.jsonb_build_object(
        'id', 'baseline-1',
        'createdAt', 999,
        'provenance', 'fresh',
        'fingerprint', 'baseline-' || p_marker,
        'xp', 0,
        'totalWords', 0,
        'totalChallenges', 0
      ),
      'baselineConflicts', '[]'::jsonb,
      'operations', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id', 'progress-1',
        'baselineId', 'baseline-1',
        'kind', 'entry-submit',
        'entryId', 'entry-1',
        'versionId', 'version-1',
        'createdAt', 1000 + p_sequence,
        'xpDelta', p_xp,
        'totalWordsDelta', 8 + p_sequence,
        'totalChallengesDelta', 1
      )),
      'updatedAt', 1000 + p_sequence
    )
  );
end;
$$;

create or replace function writers_test.make_archive(p_payload jsonb)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'entry_id', p_payload #>> '{entries,0,id}',
    'version_id', p_payload #>> '{entries,0,versions,0,id}',
    'version_payload', p_payload #> '{entries,0,versions,0}'
  ))
$$;

create or replace function writers_test.canonical(p_payload jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select p_payload::text
$$;

create or replace function writers_test.hash_text(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_value, 'UTF8'), 'sha256'),
    'hex'
  )
$$;

create or replace function writers_test.sync_candidate(
  p_payload jsonb,
  p_archive jsonb,
  p_expected_version bigint,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_value text := writers_test.canonical(p_payload);
  space_id_value uuid;
begin
  select id into space_id_value
  from public.writer_spaces
  where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  return public.sync_writer_space(
    p_space_id => space_id_value,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_expected_version => p_expected_version,
    p_operation_id => p_operation_id,
    p_payload => p_payload,
    p_payload_hash => writers_test.hash_text(canonical_value),
    p_entry_versions => p_archive,
    p_payload_canonical => canonical_value
  );
end;
$$;

create or replace function writers_test.concurrent_create()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload_value jsonb := writers_test.make_payload(
    'initial', 10, 0,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  canonical_value text;
begin
  canonical_value := writers_test.canonical(payload_value);
  return public.create_writer_space(
    p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_recovery_code => repeat('A', 43),
    p_operation_id => 'c0000000-0000-4000-8000-000000000010'::uuid,
    p_payload => payload_value,
    p_payload_hash => writers_test.hash_text(canonical_value),
    p_entry_versions => writers_test.make_archive(payload_value),
    p_payload_canonical => canonical_value
  );
end;
$$;

create or replace function writers_test.concurrent_sync(p_marker text, p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload_value jsonb;
begin
  payload_value := writers_test.make_payload(
    p_marker,
    case when p_marker = 'race-a' then 40 else 41 end,
    case when p_marker = 'race-a' then 4 else 5 end,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  return writers_test.sync_candidate(
    payload_value,
    writers_test.make_archive(payload_value),
    3,
    p_operation_id
  );
end;
$$;

create or replace function writers_test.space_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.writer_spaces
  where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
$$;

create or replace function writers_test.receipt_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.count(*) from writers_private.sync_operations
$$;

revoke all on all functions in schema writers_test from public, anon, authenticated;
grant execute on all functions in schema writers_test to authenticated;
grant usage on schema writers_test to anon;
grant execute on function writers_test.assert_true(boolean, text) to anon;

\echo 'Contract digests and privilege surface'

select writers_test.assert_true(
  writers_private.canonical_payload_matches(
    $json${"earnings":{"ledger":[{"amount":1e-7,"paidAt":-0}],"lifetimePaid":1e21,"lifetimePending":5e-324},"settings":{"dailyCapDollars":1e-6},"writer":{"xp":9007199254740992,"totalWords":1e20}}$json$::jsonb,
    '92dbf39e6506a2f0703acddd9b889c65a32e4ae6ab5f4f6bed52ca0184c51a4e',
    $canonical${"earnings":{"ledger":[{"amount":1e-7,"paidAt":0}],"lifetimePaid":1e+21,"lifetimePending":5e-324},"settings":{"dailyCapDollars":0.000001},"writer":{"totalWords":100000000000000000000,"xp":9007199254740992}}$canonical$
  ),
  'Node numeric canonical fixture matches PostgreSQL JSONB and SHA256'
);

select writers_test.assert_true(
  writers_private.canonical_payload_matches(
    $json${"array":[-0,1.25,1e-7,1e21],"nested":{"10":"ten","2":"two","a":"A","é":"accent","😀":"face"},"unicode":"世界 — café 😀","z":"line\ncontrol:\u0001"}$json$::jsonb,
    'b5aacfa149d27a158d61f0cf1fa8866b5f74323bbd83e09990092c404a0849b7',
    $canonical${"array":[0,1.25,1e-7,1e+21],"nested":{"2":"two","10":"ten","a":"A","é":"accent","😀":"face"},"unicode":"世界 — café 😀","z":"line\ncontrol:\u0001"}$canonical$
  ),
  'Node UTF-16 key order, integer-index keys, control escapes, and Unicode fixture matches'
);

select writers_test.assert_true(
  not writers_private.canonical_payload_matches('{}'::jsonb, repeat('0', 64), '{broken'),
  'malformed canonical JSON returns false instead of raising'
);

select writers_test.assert_true(
  not pg_catalog.has_schema_privilege('authenticated', 'writers_private', 'USAGE'),
  'authenticated has no private schema usage'
);
select writers_test.assert_true(
  not pg_catalog.has_schema_privilege('anon', 'writers_private', 'USAGE'),
  'anon has no private schema usage'
);
select writers_test.assert_true(
  not pg_catalog.has_table_privilege('authenticated', 'writers_private.sync_operations', 'SELECT'),
  'authenticated cannot read private receipts'
);
select writers_test.assert_true(
  not pg_catalog.has_table_privilege('authenticated', 'public.writer_spaces', 'INSERT,UPDATE,DELETE'),
  'authenticated cannot mutate public writer tables directly'
);
select writers_test.assert_true(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_writer_space(uuid,uuid,text,uuid,jsonb,text,jsonb,text)',
    'EXECUTE'
  ),
  'authenticated can execute the additive create signature'
);
select writers_test.assert_true(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_writer_space(uuid,uuid,text,uuid,jsonb,text,jsonb,text)',
    'EXECUTE'
  ),
  'anon cannot execute create RPC'
);
select writers_test.assert_true(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'writers_private.payload_is_safe(jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute private validation helpers'
);

set role anon;
do $$
declare
  denied boolean := false;
begin
  begin
    perform public.get_writer_space_state('00000000-0000-4000-8000-000000000000'::uuid);
  exception when insufficient_privilege then
    denied := true;
  end;
  perform writers_test.assert_true(denied, 'anon RPC execution is denied by grant');
end;
$$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '', false);
select writers_test.assert_status(
  public.get_writer_space_state('00000000-0000-4000-8000-000000000000'::uuid),
  'forbidden',
  'authenticated role without auth.uid is forbidden'
);
reset role;

\echo 'Concurrent fresh-create replay after both callers observe no lineage'
\! set -eu; socket=/tmp/writers-studio-cloud-20261003/pg-socket; port=49731; database=postgres; tmp=$(mktemp -d /tmp/writers-studio-create-race.XXXXXX); blocker_pid=; a_pid=; b_pid=; sql() { psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" "$@"; }; cleanup() { for race_pid in "$blocker_pid" "$a_pid" "$b_pid"; do if [ -n "$race_pid" ]; then kill "$race_pid" 2>/dev/null || true; fi; done; rm -rf "$tmp"; }; trap cleanup 0 1 2 15; PGAPPNAME=writers_sql_create_blocker psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -f scripts/test-cloud-sql-create-blocker.sql >"$tmp/blocker.out" 2>"$tmp/blocker.err" & blocker_pid=$!; blocker_ready=0; i=0; while [ "$i" -lt 100 ]; do held=$(sql -c "select pg_catalog.count(*) from pg_catalog.pg_stat_activity activity join pg_catalog.pg_locks held on held.pid = activity.pid where activity.application_name = 'writers_sql_create_blocker' and activity.query like '%pg_sleep%' and held.locktype = 'advisory' and held.granted"); if [ "$held" = 1 ]; then blocker_ready=1; break; fi; i=$((i + 1)); sleep 0.1; done; if [ "$blocker_ready" -ne 1 ]; then echo 'create-race blocker did not acquire its advisory lock' >&2; sed -n '1,120p' "$tmp/blocker.err" >&2; exit 1; fi; PGAPPNAME=writers_sql_create_a psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -f scripts/test-cloud-sql-create-candidate.sql >"$tmp/a.out" 2>"$tmp/a.err" & a_pid=$!; PGAPPNAME=writers_sql_create_b psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -f scripts/test-cloud-sql-create-candidate.sql >"$tmp/b.out" 2>"$tmp/b.err" & b_pid=$!; overlap=0; i=0; while [ "$i" -lt 100 ]; do waiters=$(sql -c "select pg_catalog.count(distinct activity.application_name) from pg_catalog.pg_stat_activity activity where activity.application_name in ('writers_sql_create_a', 'writers_sql_create_b') and activity.wait_event_type = 'Lock' and exists (select 1 from pg_catalog.pg_locks awaited where awaited.pid = activity.pid and not awaited.granted)"); if [ "$waiters" = 2 ]; then overlap=1; break; fi; i=$((i + 1)); sleep 0.1; done; if [ "$overlap" -ne 1 ]; then echo 'create-race candidates did not overlap on observed lock waits' >&2; sql -c "select application_name, state, wait_event_type, wait_event from pg_catalog.pg_stat_activity where application_name like 'writers_sql_create_%' order by application_name" >&2 || true; sed -n '1,120p' "$tmp/a.err" "$tmp/b.err" >&2; exit 1; fi; terminated=$(sql -c "insert into writers_test.race_observations (race_name, observed_waiters) values ('create', 2); select pg_catalog.pg_terminate_backend(pid, 5000) from pg_catalog.pg_stat_activity where application_name = 'writers_sql_create_blocker'"); if [ "$terminated" != t ]; then echo 'create-race blocker was not released cleanly' >&2; exit 1; fi; blocker_exit=0; wait "$blocker_pid" || blocker_exit=$?; blocker_pid=; a_exit=0; b_exit=0; wait "$a_pid" || a_exit=$?; a_pid=; wait "$b_pid" || b_exit=$?; b_pid=; if [ "$blocker_exit" -eq 0 ] || [ "$a_exit" -ne 0 ] || [ "$b_exit" -ne 0 ]; then echo "create-race subprocess failure: blocker=$blocker_exit a=$a_exit b=$b_exit" >&2; sed -n '1,120p' "$tmp/blocker.err" "$tmp/a.err" "$tmp/b.err" >&2; exit 1; fi; if ! grep -q '"status": "ok"' "$tmp/a.out" || ! grep -q '"status": "ok"' "$tmp/b.out" || ! cmp -s "$tmp/a.out" "$tmp/b.out"; then echo 'concurrent creates did not return identical ok receipts' >&2; sed -n '1,20p' "$tmp/a.out" "$tmp/b.out" >&2; exit 1; fi; echo 'create-a=ok create-b=ok identical-receipt=yes observed-waiters=2'

\if :SHELL_ERROR
  \echo 'Concurrent create orchestration failed with exit code' :SHELL_EXIT_CODE
  do $shell_failure$
  begin
    raise exception 'concurrent create orchestration shell command failed';
  end;
  $shell_failure$;
\endif

select writers_test.assert_true(
  (select observed_waiters from writers_test.race_observations where race_name = 'create') = 2,
  'concurrent creates were both observed waiting before blocker release'
);

select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 1,
  'concurrent identical creates produce one writer space'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots) = 1,
  'concurrent identical creates produce one initial snapshot'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from writers_private.sync_operations
   where operation_id = 'c0000000-0000-4000-8000-000000000010'::uuid) = 1,
  'concurrent identical creates share one stable receipt'
);

truncate table
  public.writer_space_memberships,
  public.writer_entry_versions,
  public.writer_progress_events,
  public.writer_legacy_baselines,
  writers_private.sync_operations,
  writers_private.recovery_secrets,
  writers_private.recovery_claim_limits,
  public.writer_snapshots,
  public.writer_spaces;

\echo 'Create RPC, canonical proof, replay identity, and membership isolation'

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare
  payload_value jsonb := writers_test.make_payload(
    'initial', 10, 0,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  changed_payload jsonb;
  archive_value jsonb;
  changed_archive jsonb;
  canonical_value text;
  changed_canonical text;
  payload_hash_value text;
  first_result jsonb;
  replay_result jsonb;
begin
  archive_value := writers_test.make_archive(payload_value);
  canonical_value := writers_test.canonical(payload_value);
  payload_hash_value := writers_test.hash_text(canonical_value);

  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000000'::uuid,
      p_payload => payload_value,
      p_payload_hash => payload_hash_value,
      p_entry_versions => archive_value
    ),
    'invalid',
    'create rejects omitted canonical text through its default-null argument'
  );

  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => null,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000001'::uuid,
      p_payload => payload_value,
      p_payload_hash => payload_hash_value,
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'create rejects a null generation'
  );

  first_result := public.create_writer_space(
    p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_recovery_code => repeat('A', 43),
    p_operation_id => 'c0000000-0000-4000-8000-000000000010'::uuid,
    p_payload => payload_value,
    p_payload_hash => payload_hash_value,
    p_entry_versions => archive_value,
    p_payload_canonical => canonical_value
  );
  perform writers_test.assert_status(first_result, 'ok', 'A creates a writer space');
  perform writers_test.assert_true(
    first_result ?& array['space_id', 'generation', 'version', 'payload', 'payload_hash', 'updated_at'],
    'create result retains the established response shape'
  );
  perform writers_test.assert_true(
    pg_catalog.strpos(first_result::text, repeat('A', 43)) = 0,
    'create result does not expose the recovery code'
  );
  perform writers_test.assert_status(
    public.get_writer_space_state((first_result ->> 'space_id')::uuid),
    'ok',
    'A can read the created writer space through the pull RPC'
  );

  replay_result := public.create_writer_space(
    p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_recovery_code => repeat('A', 43),
    p_operation_id => 'c0000000-0000-4000-8000-000000000010'::uuid,
    p_payload => payload_value,
    p_payload_hash => payload_hash_value,
    p_entry_versions => archive_value,
    p_payload_canonical => canonical_value
  );
  perform writers_test.assert_true(
    replay_result is not distinct from first_result,
    'identical create replay returns the stored receipt'
  );

  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('C', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000012'::uuid,
      p_payload => payload_value,
      p_payload_hash => payload_hash_value,
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'existing-space create with a new operation rejects a nonmatching recovery code'
  );

  first_result := public.create_writer_space(
    p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_recovery_code => repeat('A', 43),
    p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
    p_payload => payload_value,
    p_payload_hash => payload_hash_value,
    p_entry_versions => archive_value,
    p_payload_canonical => canonical_value
  );
  perform writers_test.assert_status(
    first_result,
    'ok',
    'existing-space create with the stored recovery code records a new receipt'
  );
  replay_result := public.create_writer_space(
    p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    p_recovery_code => repeat('A', 43),
    p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
    p_payload => payload_value,
    p_payload_hash => payload_hash_value,
    p_entry_versions => archive_value,
    p_payload_canonical => canonical_value
  );
  perform writers_test.assert_true(
    replay_result is not distinct from first_result,
    'existing-space create exact retry returns its stable stored receipt'
  );

  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
      p_payload => payload_value,
      p_payload_hash => repeat('0', 64),
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'create rejects a payload hash that does not match canonical bytes'
  );

  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('C', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
      p_payload => payload_value,
      p_payload_hash => payload_hash_value,
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'create replay identity binds the hashed recovery code'
  );

  changed_archive := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload,text}',
    pg_catalog.to_jsonb('archive retry variant'::text)
  );
  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
      p_payload => payload_value,
      p_payload_hash => payload_hash_value,
      p_entry_versions => changed_archive,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'existing-space create receipt binds the full archive'
  );

  changed_payload := writers_test.make_payload(
    'changed-retry', 11, 1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  changed_canonical := writers_test.canonical(changed_payload);
  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
      p_payload => changed_payload,
      p_payload_hash => writers_test.hash_text(changed_canonical),
      p_entry_versions => writers_test.make_archive(changed_payload),
      p_payload_canonical => changed_canonical
    ),
    'invalid',
    'existing-space create receipt rejects a changed payload'
  );

  changed_canonical := canonical_value || ' ';
  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000011'::uuid,
      p_payload => payload_value,
      p_payload_hash => writers_test.hash_text(changed_canonical),
      p_entry_versions => archive_value,
      p_payload_canonical => changed_canonical
    ),
    'invalid',
    'existing-space create receipt binds exact canonical text and its hash'
  );
end;
$$;

reset role;

select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 1,
  'invalid create attempts do not leave shell spaces'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_space_memberships
   where user_id = '11111111-1111-4111-8111-111111111111'::uuid) = 1,
  'fresh membership is derived only from auth.uid'
);
select writers_test.assert_true(
  (select actor_user_id from public.writer_snapshots
   where operation_id = 'c0000000-0000-4000-8000-000000000010'::uuid)
    = '11111111-1111-4111-8111-111111111111'::uuid,
  'snapshot actor is derived from auth.uid'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from writers_private.sync_operations
   where operation_id = 'c0000000-0000-4000-8000-000000000011'::uuid) = 1,
  'valid existing-space create with a new operation stores one receipt'
);
select writers_test.assert_true(
  not exists (
    select 1 from writers_private.sync_operations
    where pg_catalog.strpos(result::text, repeat('A', 43)) > 0
  ),
  'stored receipts do not contain raw recovery codes'
);
select writers_test.assert_true(
  (select pg_catalog.encode(recovery_hash, 'hex') from writers_private.recovery_secrets)
    = writers_test.hash_text(repeat('A', 43)),
  'only the recovery-code SHA256 is stored'
);

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);

select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 0,
  'B cannot read A writer_spaces through RLS'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots) = 0,
  'B cannot read A snapshots through RLS'
);
select writers_test.assert_status(
  public.get_writer_space_state(writers_test.space_id()),
  'forbidden',
  'B cannot read A head through the public pull RPC'
);

do $$
declare
  payload_value jsonb := writers_test.make_payload(
    'initial', 10, 0,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  archive_value jsonb;
  canonical_value text;
  denied boolean := false;
begin
  archive_value := writers_test.make_archive(payload_value);
  canonical_value := writers_test.canonical(payload_value);
  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('A', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000010'::uuid,
      p_payload => payload_value,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'forbidden',
    'B cannot read A exact create receipt before membership'
  );

  begin
    insert into public.writer_space_memberships (space_id, user_id, joined_via)
    values (
      '00000000-0000-4000-8000-000000000000'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      'recovery'
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  perform writers_test.assert_true(denied, 'B cannot forge a membership row');

  denied := false;
  begin
    perform writers_private.payload_is_safe(payload_value);
  exception when insufficient_privilege then
    denied := true;
  end;
  perform writers_test.assert_true(denied, 'B cannot invoke a private helper');
end;
$$;

do $$
declare
  payload_value jsonb := writers_test.make_payload(
    'generation-collision', 10, 0,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  canonical_value text;
begin
  canonical_value := writers_test.canonical(payload_value);
  perform writers_test.assert_status(
    public.create_writer_space(
      p_lineage_id => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_recovery_code => repeat('D', 43),
      p_operation_id => 'c0000000-0000-4000-8000-000000000020'::uuid,
      p_payload => payload_value,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => writers_test.make_archive(payload_value),
      p_payload_canonical => canonical_value
    ),
    'forbidden',
    'B cannot claim an existing generation through new metadata'
  );
end;
$$;

reset role;

select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 1,
  'metadata collision does not create a second writer space'
);

\echo 'Sync fences, CAS, idempotency, validation, secrets, and byte limits'

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

do $$
declare
  initial_payload jsonb := writers_test.make_payload(
    'initial', 10, 0,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  next_payload jsonb := writers_test.make_payload(
    'accepted-two', 20, 2,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  third_payload jsonb := writers_test.make_payload(
    'accepted-three', 30, 3,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  stale_payload jsonb := writers_test.make_payload(
    'stale-conflict', 25, 20,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  payload_value jsonb;
  archive_value jsonb;
  changed_archive jsonb;
  canonical_value text;
  changed_canonical text;
  first_result jsonb;
  replay_result jsonb;
begin
  archive_value := writers_test.make_archive(initial_payload);
  canonical_value := writers_test.canonical(initial_payload);

  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => null,
      p_operation_id => 'd0000000-0000-4000-8000-000000000001'::uuid,
      p_payload => initial_payload,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'sync rejects a null expected version'
  );
  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => 1,
      p_operation_id => 'd0000000-0000-4000-8000-000000000002'::uuid,
      p_payload => initial_payload,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => archive_value,
      p_payload_canonical => null
    ),
    'invalid',
    'sync rejects null canonical text'
  );
  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => '99999999-9999-4999-8999-999999999999'::uuid,
      p_expected_version => 1,
      p_operation_id => 'd0000000-0000-4000-8000-000000000003'::uuid,
      p_payload => initial_payload,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'forbidden',
    'sync rejects a generation parameter different from the locked head'
  );

  payload_value := initial_payload #- '{progress,lineageId}';
  perform writers_test.assert_status(
    writers_test.sync_candidate(
      payload_value,
      writers_test.make_archive(payload_value),
      1,
      'd0000000-0000-4000-8000-000000000004'::uuid
    ),
    'invalid',
    'sync rejects missing payload lineage'
  );
  payload_value := pg_catalog.jsonb_set(initial_payload, '{progress,generation}', 'null'::jsonb);
  perform writers_test.assert_status(
    writers_test.sync_candidate(
      payload_value,
      writers_test.make_archive(payload_value),
      1,
      'd0000000-0000-4000-8000-000000000005'::uuid
    ),
    'invalid',
    'sync rejects null payload generation'
  );
  payload_value := pg_catalog.jsonb_set(
    initial_payload,
    '{progress,lineageId}',
    pg_catalog.to_jsonb('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(
      payload_value,
      writers_test.make_archive(payload_value),
      1,
      'd0000000-0000-4000-8000-000000000006'::uuid
    ),
    'invalid',
    'sync rejects payload lineage different from the locked row'
  );
  payload_value := pg_catalog.jsonb_set(
    initial_payload,
    '{progress,generation}',
    pg_catalog.to_jsonb('99999999-9999-4999-8999-999999999999'::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(
      payload_value,
      writers_test.make_archive(payload_value),
      1,
      'd0000000-0000-4000-8000-000000000007'::uuid
    ),
    'invalid',
    'sync rejects payload generation different from parameter and head'
  );

  first_result := writers_test.sync_candidate(
    next_payload,
    writers_test.make_archive(next_payload),
    1,
    'd0000000-0000-4000-8000-000000000010'::uuid
  );
  perform writers_test.assert_status(first_result, 'ok', 'correct CAS sync advances head to version two');
  perform writers_test.assert_true(
    (first_result ->> 'version')::bigint = 2,
    'accepted sync reports version two'
  );

  replay_result := writers_test.sync_candidate(
    next_payload,
    writers_test.make_archive(next_payload),
    1,
    'd0000000-0000-4000-8000-000000000010'::uuid
  );
  perform writers_test.assert_true(
    replay_result is not distinct from first_result,
    'identical sync replay returns the stored receipt'
  );

  perform writers_test.assert_status(
    writers_test.sync_candidate(
      third_payload,
      writers_test.make_archive(third_payload),
      1,
      'd0000000-0000-4000-8000-000000000010'::uuid
    ),
    'invalid',
    'sync replay identity rejects a changed payload and hash'
  );

  archive_value := writers_test.make_archive(next_payload);
  changed_archive := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload,text}',
    pg_catalog.to_jsonb('changed archive retry'::text)
  );
  canonical_value := writers_test.canonical(next_payload);
  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => 1,
      p_operation_id => 'd0000000-0000-4000-8000-000000000010'::uuid,
      p_payload => next_payload,
      p_payload_hash => writers_test.hash_text(canonical_value),
      p_entry_versions => changed_archive,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'sync replay identity binds the full archive'
  );
  changed_canonical := canonical_value || ' ';
  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => 1,
      p_operation_id => 'd0000000-0000-4000-8000-000000000010'::uuid,
      p_payload => next_payload,
      p_payload_hash => writers_test.hash_text(changed_canonical),
      p_entry_versions => archive_value,
      p_payload_canonical => changed_canonical
    ),
    'invalid',
    'sync replay identity binds exact canonical bytes and payload hash'
  );
  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => 1,
      p_operation_id => 'd0000000-0000-4000-8000-000000000010'::uuid,
      p_payload => next_payload,
      p_payload_hash => repeat('f', 64),
      p_entry_versions => archive_value,
      p_payload_canonical => canonical_value
    ),
    'invalid',
    'sync rejects a changed hash that does not prove canonical content'
  );

  perform writers_test.assert_status(
    writers_test.sync_candidate(
      stale_payload,
      writers_test.make_archive(stale_payload),
      1,
      'd0000000-0000-4000-8000-000000000020'::uuid
    ),
    'conflict',
    'stale CAS is archived and returns conflict'
  );

  first_result := writers_test.sync_candidate(
    third_payload,
    writers_test.make_archive(third_payload),
    2,
    'd0000000-0000-4000-8000-000000000030'::uuid
  );
  perform writers_test.assert_status(first_result, 'ok', 'correct CAS sync advances head to version three');
  perform writers_test.assert_true(
    (first_result ->> 'version')::bigint = 3,
    'accepted sync reports version three'
  );

  payload_value := pg_catalog.jsonb_set(
    third_payload,
    '{earnings,ledger,0,amount}',
    '999'::jsonb
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(
      payload_value,
      writers_test.make_archive(payload_value),
      3,
      'd0000000-0000-4000-8000-000000000031'::uuid
    ),
    'invalid',
    'a paid ledger row must remain byte-equivalent'
  );
end;
$$;

do $$
declare
  payload_value jsonb := writers_test.make_payload(
    'entry-id-validation', 31, 3,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  candidate jsonb;
  archive_value jsonb;
  space_count_before bigint;
  membership_count_before bigint;
  snapshot_count_before bigint;
  receipt_count_before bigint;
  entry_version_count_before bigint;
  progress_event_count_before bigint;
  baseline_count_before bigint;
  head_snapshot_before uuid;
  head_hash_before text;
begin
  archive_value := writers_test.make_archive(payload_value);
  select pg_catalog.count(*) into space_count_before from public.writer_spaces;
  select pg_catalog.count(*) into membership_count_before from public.writer_space_memberships;
  select pg_catalog.count(*) into snapshot_count_before from public.writer_snapshots;
  receipt_count_before := writers_test.receipt_count();
  select pg_catalog.count(*) into entry_version_count_before from public.writer_entry_versions;
  select pg_catalog.count(*) into progress_event_count_before from public.writer_progress_events;
  select pg_catalog.count(*) into baseline_count_before from public.writer_legacy_baselines;
  select current_snapshot_id, current_payload_hash
  into head_snapshot_before, head_hash_before
  from public.writer_spaces
  where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;

  candidate := payload_value #- '{entries,0,id}';
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '11000000-0000-4000-8000-000000000001'::uuid),
    'invalid', 'accepted-path sync rejects a missing entry ID'
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 1, '11000000-0000-4000-8000-000000000011'::uuid),
    'invalid', 'stale-path sync rejects a missing entry ID before conflict archival'
  );

  candidate := pg_catalog.jsonb_set(payload_value, '{entries,0,id}', 'null'::jsonb);
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '11000000-0000-4000-8000-000000000002'::uuid),
    'invalid', 'accepted-path sync rejects a null entry ID'
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 1, '11000000-0000-4000-8000-000000000012'::uuid),
    'invalid', 'stale-path sync rejects a null entry ID before conflict archival'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value, '{entries,0,id}', pg_catalog.to_jsonb(''::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '11000000-0000-4000-8000-000000000003'::uuid),
    'invalid', 'accepted-path sync rejects an empty entry ID'
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 1, '11000000-0000-4000-8000-000000000013'::uuid),
    'invalid', 'stale-path sync rejects an empty entry ID before conflict archival'
  );

  candidate := pg_catalog.jsonb_set(payload_value, '{entries,0,id}', '42'::jsonb);
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '11000000-0000-4000-8000-000000000004'::uuid),
    'invalid', 'accepted-path sync rejects a non-string entry ID'
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 1, '11000000-0000-4000-8000-000000000014'::uuid),
    'invalid', 'stale-path sync rejects a non-string entry ID before conflict archival'
  );

  perform writers_test.assert_true(
    (select pg_catalog.count(*) from public.writer_spaces) = space_count_before
      and (select pg_catalog.count(*) from public.writer_space_memberships) = membership_count_before
      and (
        select head_version = 3
          and current_snapshot_id is not distinct from head_snapshot_before
          and current_payload_hash is not distinct from head_hash_before
        from public.writer_spaces
        where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      ),
    'malformed entry IDs leave the writer space and accepted head unchanged'
  );
  perform writers_test.assert_true(
    (select pg_catalog.count(*) from public.writer_snapshots) = snapshot_count_before
      and writers_test.receipt_count() = receipt_count_before,
    'malformed entry IDs create no snapshot or operation receipt'
  );
  perform writers_test.assert_true(
    (select pg_catalog.count(*) from public.writer_entry_versions) = entry_version_count_before
      and (select pg_catalog.count(*) from public.writer_progress_events) = progress_event_count_before
      and (select pg_catalog.count(*) from public.writer_legacy_baselines) = baseline_count_before,
    'malformed entry IDs create no entry, progress, or baseline archive rows'
  );
end;
$$;

do $$
declare
  payload_value jsonb := writers_test.make_payload(
    'validation-base', 31, 3,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    0.1
  );
  candidate jsonb;
  archive_value jsonb;
  huge_archive jsonb;
begin
  archive_value := writers_test.make_archive(payload_value);

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{entries}',
    (payload_value -> 'entries') || pg_catalog.jsonb_build_array(payload_value #> '{entries,0}')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 3, '10000000-0000-4000-8000-000000000001'::uuid),
    'invalid', 'duplicate entry IDs are rejected'
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 1, '10000000-0000-4000-8000-000000000002'::uuid),
    'invalid', 'duplicate entries are rejected before stale conflict archival'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{earnings,ledger}',
    (payload_value #> '{earnings,ledger}') || pg_catalog.jsonb_build_array(payload_value #> '{earnings,ledger,0}')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 3, '10000000-0000-4000-8000-000000000003'::uuid),
    'invalid', 'duplicate ledger IDs are rejected before terminal-row lookup'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{progress,operations}',
    (payload_value #> '{progress,operations}') || pg_catalog.jsonb_build_array(payload_value #> '{progress,operations,0}')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 3, '10000000-0000-4000-8000-000000000004'::uuid),
    'invalid', 'duplicate progress operation IDs are rejected'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{progress,baselineConflicts}',
    pg_catalog.jsonb_build_array(payload_value #> '{progress,baseline}')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 3, '10000000-0000-4000-8000-000000000005'::uuid),
    'invalid', 'duplicate baseline identities are rejected'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{entries,0,versions}',
    (payload_value #> '{entries,0,versions}') || pg_catalog.jsonb_build_array(payload_value #> '{entries,0,versions,0}')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, writers_test.make_archive(candidate), 3, '10000000-0000-4000-8000-000000000006'::uuid),
    'invalid', 'duplicate nested EntryVersion IDs are rejected'
  );

  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, archive_value || archive_value, 3, '10000000-0000-4000-8000-000000000007'::uuid),
    'invalid', 'duplicate archive entry/version identities are rejected'
  );

  candidate := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload}',
    (archive_value #> '{0,version_payload}') || pg_catalog.jsonb_build_object('futureUnknown', true)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, candidate, 3, '10000000-0000-4000-8000-000000000008'::uuid),
    'invalid', 'unknown EntryVersion keys are rejected'
  );
  candidate := pg_catalog.jsonb_set(
    archive_value,
    '{0}',
    (archive_value -> 0) || pg_catalog.jsonb_build_object('extra_outer_key', true)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, candidate, 3, '10000000-0000-4000-8000-000000000009'::uuid),
    'invalid', 'unknown archive envelope keys are rejected'
  );

  candidate := payload_value || pg_catalog.jsonb_build_object('auth', pg_catalog.jsonb_build_object('user', 'forged'));
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '10000000-0000-4000-8000-000000000010'::uuid),
    'invalid', 'top-level auth fields are rejected'
  );
  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{settings}',
    (payload_value -> 'settings') || pg_catalog.jsonb_build_object('geminiApiKey', 'secret-value')
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '10000000-0000-4000-8000-000000000011'::uuid),
    'invalid', 'device-only settings secrets are rejected'
  );
  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{writer,profile}',
    pg_catalog.jsonb_build_object('session', pg_catalog.jsonb_build_object('accessToken', 'secret-value')),
    true
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '10000000-0000-4000-8000-000000000012'::uuid),
    'invalid', 'nested credential and session fields are rejected'
  );
  candidate := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload,judge,metadata}',
    pg_catalog.jsonb_build_object('secret', 'secret-value'),
    true
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, candidate, 3, '10000000-0000-4000-8000-000000000013'::uuid),
    'invalid', 'recursive secrets inside archive payloads are rejected'
  );

  perform writers_test.assert_status(
    public.sync_writer_space(
      p_space_id => writers_test.space_id(),
      p_generation => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      p_expected_version => 3,
      p_operation_id => '10000000-0000-4000-8000-000000000014'::uuid,
      p_payload => payload_value,
      p_payload_hash => writers_test.hash_text(writers_test.canonical(payload_value)),
      p_entry_versions => archive_value,
      p_payload_canonical => repeat('x', 20971521)
    ),
    'invalid',
    'oversize canonical text is rejected before parsing'
  );

  huge_archive := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload,text}',
    pg_catalog.to_jsonb(repeat('x', 20971520))
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, huge_archive, 3, '10000000-0000-4000-8000-000000000015'::uuid),
    'invalid', 'combined payload and archive byte budget is enforced'
  );

  select pg_catalog.jsonb_agg('{}'::jsonb) into huge_archive
  from pg_catalog.generate_series(1, 50001);
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, huge_archive, 3, '10000000-0000-4000-8000-000000000016'::uuid),
    'invalid', 'archive record count is bounded before archival loops'
  );

  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{craft,practicedSkills}',
    pg_catalog.to_jsonb('not-an-array'::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '10000000-0000-4000-8000-000000000017'::uuid),
    'invalid', 'malformed known array shapes return invalid instead of raising'
  );
  candidate := pg_catalog.jsonb_set(
    payload_value,
    '{writer,xp}',
    pg_catalog.to_jsonb('not-a-number'::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(candidate, archive_value, 3, '10000000-0000-4000-8000-000000000018'::uuid),
    'invalid', 'malformed counter types return invalid instead of raising'
  );
  candidate := pg_catalog.jsonb_set(
    archive_value,
    '{0,version_payload,gradingComplete}',
    pg_catalog.to_jsonb('true'::text)
  );
  perform writers_test.assert_status(
    writers_test.sync_candidate(payload_value, candidate, 3, '10000000-0000-4000-8000-000000000019'::uuid),
    'invalid', 'EntryVersion field types are enforced'
  );
end;
$$;

reset role;

select writers_test.assert_true(
  (select head_version from public.writer_spaces
   where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) = 3,
  'invalid and stale requests do not poison the accepted head'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots
   where operation_id = 'd0000000-0000-4000-8000-000000000010'::uuid) = 1,
  'identical sync replay records one immutable snapshot'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from writers_private.sync_operations
   where operation_id = 'd0000000-0000-4000-8000-000000000010'::uuid) = 1,
  'identical sync replay records one operation receipt'
);
select writers_test.assert_true(
  (select disposition from public.writer_snapshots
   where operation_id = 'd0000000-0000-4000-8000-000000000020'::uuid) = 'conflict',
  'stale snapshot is retained with conflict disposition'
);

\echo 'Concurrent two-connection CAS race'
\! set -eu; socket=/tmp/writers-studio-cloud-20261003/pg-socket; port=49731; database=postgres; tmp=$(mktemp -d /tmp/writers-studio-cas-race.XXXXXX); blocker_pid=; a_pid=; b_pid=; sql() { psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" "$@"; }; cleanup() { for race_pid in "$blocker_pid" "$a_pid" "$b_pid"; do if [ -n "$race_pid" ]; then kill "$race_pid" 2>/dev/null || true; fi; done; rm -rf "$tmp"; }; trap cleanup 0 1 2 15; PGAPPNAME=writers_sql_cas_blocker psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -f scripts/test-cloud-sql-cas-blocker.sql >"$tmp/blocker.out" 2>"$tmp/blocker.err" & blocker_pid=$!; blocker_ready=0; i=0; while [ "$i" -lt 100 ]; do held=$(sql -c "select pg_catalog.count(distinct activity.pid) from pg_catalog.pg_stat_activity activity join pg_catalog.pg_locks held on held.pid = activity.pid where activity.application_name = 'writers_sql_cas_blocker' and activity.query like '%pg_sleep%' and held.locktype = 'transactionid' and held.mode = 'ExclusiveLock' and held.granted"); if [ "$held" = 1 ]; then blocker_ready=1; break; fi; i=$((i + 1)); sleep 0.1; done; if [ "$blocker_ready" -ne 1 ]; then echo 'CAS-race blocker did not acquire the writer-space row lock' >&2; sed -n '1,120p' "$tmp/blocker.err" >&2; exit 1; fi; PGAPPNAME=writers_sql_cas_a psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -v race_marker=race-a -v operation_id=40000000-0000-4000-8000-000000000001 -f scripts/test-cloud-sql-cas-candidate.sql >"$tmp/a.out" 2>"$tmp/a.err" & a_pid=$!; PGAPPNAME=writers_sql_cas_b psql -X -qAt -v ON_ERROR_STOP=1 -h "$socket" -p "$port" -d "$database" -v race_marker=race-b -v operation_id=40000000-0000-4000-8000-000000000002 -f scripts/test-cloud-sql-cas-candidate.sql >"$tmp/b.out" 2>"$tmp/b.err" & b_pid=$!; overlap=0; i=0; while [ "$i" -lt 100 ]; do waiters=$(sql -c "select pg_catalog.count(distinct activity.application_name) from pg_catalog.pg_stat_activity activity where activity.application_name in ('writers_sql_cas_a', 'writers_sql_cas_b') and activity.wait_event_type = 'Lock' and exists (select 1 from pg_catalog.pg_locks awaited where awaited.pid = activity.pid and not awaited.granted)"); if [ "$waiters" = 2 ]; then overlap=1; break; fi; i=$((i + 1)); sleep 0.1; done; if [ "$overlap" -ne 1 ]; then echo 'CAS-race candidates did not overlap on observed row-lock waits' >&2; sql -c "select application_name, state, wait_event_type, wait_event from pg_catalog.pg_stat_activity where application_name like 'writers_sql_cas_%' order by application_name" >&2 || true; sed -n '1,120p' "$tmp/a.err" "$tmp/b.err" >&2; exit 1; fi; terminated=$(sql -c "insert into writers_test.race_observations (race_name, observed_waiters) values ('cas', 2); select pg_catalog.pg_terminate_backend(pid, 5000) from pg_catalog.pg_stat_activity where application_name = 'writers_sql_cas_blocker'"); if [ "$terminated" != t ]; then echo 'CAS-race blocker was not released cleanly' >&2; exit 1; fi; blocker_exit=0; wait "$blocker_pid" || blocker_exit=$?; blocker_pid=; a_exit=0; b_exit=0; wait "$a_pid" || a_exit=$?; a_pid=; wait "$b_pid" || b_exit=$?; b_pid=; if [ "$blocker_exit" -eq 0 ] || [ "$a_exit" -ne 0 ] || [ "$b_exit" -ne 0 ]; then echo "CAS-race subprocess failure: blocker=$blocker_exit a=$a_exit b=$b_exit" >&2; sed -n '1,120p' "$tmp/blocker.err" "$tmp/a.err" "$tmp/b.err" >&2; exit 1; fi; race_a_status=$(tr -d '[:space:]' <"$tmp/a.out"); race_b_status=$(tr -d '[:space:]' <"$tmp/b.out"); if ! { [ "$race_a_status" = ok ] && [ "$race_b_status" = conflict ]; } && ! { [ "$race_a_status" = conflict ] && [ "$race_b_status" = ok ]; }; then echo "unexpected CAS-race results: race-a=$race_a_status race-b=$race_b_status" >&2; exit 1; fi; echo "race-a=$race_a_status race-b=$race_b_status observed-waiters=2"

\if :SHELL_ERROR
  \echo 'Concurrent CAS orchestration failed with exit code' :SHELL_EXIT_CODE
  do $shell_failure$
  begin
    raise exception 'concurrent CAS orchestration shell command failed';
  end;
  $shell_failure$;
\endif

select writers_test.assert_true(
  (select observed_waiters from writers_test.race_observations where race_name = 'cas') = 2,
  'both CAS candidates were observed waiting before blocker release'
);

select writers_test.assert_true(
  (select head_version from public.writer_spaces
   where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) = 4,
  'two concurrent expected-version-three writers advance the head exactly once'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots
   where operation_id in (
     '40000000-0000-4000-8000-000000000001'::uuid,
     '40000000-0000-4000-8000-000000000002'::uuid
   )) = 2,
  'both concurrent requests retain immutable snapshots'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots
   where operation_id in (
     '40000000-0000-4000-8000-000000000001'::uuid,
     '40000000-0000-4000-8000-000000000002'::uuid
   ) and disposition = 'accepted') = 1,
  'exactly one concurrent request is accepted'
);
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_snapshots
   where operation_id in (
     '40000000-0000-4000-8000-000000000001'::uuid,
     '40000000-0000-4000-8000-000000000002'::uuid
   ) and disposition = 'conflict') = 1,
  'exactly one concurrent request is archived as conflict'
);
select writers_test.assert_true(
  (select pg_catalog.count(distinct content_hash)
   from public.writer_entry_versions
   where entry_id = 'entry-1' and version_id = 'version-1') >= 6,
  'same entry/version ID retains different-content archive variants across snapshots'
);
select writers_test.assert_true(
  (select pg_catalog.count(distinct content_hash)
   from public.writer_progress_events
   where event_id = 'progress-1') >= 6,
  'same progress-event ID retains different-content variants across snapshots'
);
select writers_test.assert_true(
  (select pg_catalog.count(distinct content_hash)
   from public.writer_legacy_baselines
   where baseline_id = 'baseline-1') >= 6,
  'same baseline ID retains different-content variants across snapshots'
);

\echo 'Append-only history and direct-write boundaries'

select writers_test.assert_true(
  not (
    pg_catalog.has_table_privilege('authenticated', 'writers_private.sync_operations', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'writers_private.sync_operations', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'writers_private.sync_operations', 'DELETE')
  ),
  'authenticated cannot write private receipts'
);
select writers_test.assert_true(
  (
    select pg_catalog.bool_and(proc.prosecdef and proc.proconfig @> array['search_path=""'])
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname in (
        'get_writer_space_state', 'create_writer_space', 'sync_writer_space', 'claim_writer_space'
      )
  ),
  'all public RPCs are SECURITY DEFINER with an empty fixed search_path'
);

do $$
declare
  blocked boolean;
begin
  blocked := false;
  begin
    update public.writer_snapshots set payload = payload
    where id = (select id from public.writer_snapshots limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'snapshot UPDATE is blocked by immutable-history trigger');

  blocked := false;
  begin
    delete from public.writer_snapshots
    where id = (select id from public.writer_snapshots limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'snapshot DELETE is blocked by immutable-history trigger');

  blocked := false;
  begin
    update public.writer_entry_versions set version_payload = version_payload
    where id = (select id from public.writer_entry_versions limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'entry-version UPDATE is blocked by immutable-history trigger');

  blocked := false;
  begin
    delete from public.writer_entry_versions
    where id = (select id from public.writer_entry_versions limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'entry-version DELETE is blocked by immutable-history trigger');

  blocked := false;
  begin
    update public.writer_progress_events set event_payload = event_payload
    where id = (select id from public.writer_progress_events limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'progress-event UPDATE is blocked by immutable-history trigger');

  blocked := false;
  begin
    delete from public.writer_progress_events
    where id = (select id from public.writer_progress_events limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'progress-event DELETE is blocked by immutable-history trigger');

  blocked := false;
  begin
    update public.writer_legacy_baselines set baseline_payload = baseline_payload
    where id = (select id from public.writer_legacy_baselines limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'legacy-baseline UPDATE is blocked by immutable-history trigger');

  blocked := false;
  begin
    delete from public.writer_legacy_baselines
    where id = (select id from public.writer_legacy_baselines limit 1);
  exception when others then
    blocked := sqlerrm = 'writer history is append-only';
  end;
  perform writers_test.assert_true(blocked, 'legacy-baseline DELETE is blocked by immutable-history trigger');
end;
$$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare
  denied boolean := false;
begin
  begin
    insert into writers_private.sync_operations (space_id, operation_id, request_hash, result)
    values (
      writers_test.space_id(),
      '50000000-0000-4000-8000-000000000001'::uuid,
      repeat('0', 64),
      pg_catalog.jsonb_build_object('status', 'forged')
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  perform writers_test.assert_true(denied, 'authenticated direct private-table write is denied');
end;
$$;
reset role;

\echo 'Recovery rate limit, cooldown, and recovery membership'

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select writers_test.assert_status(
  public.claim_writer_space(repeat('B', 42) || '1'), 'invalid',
  'failed recovery claim one returns invalid and commits its counter'
);
select writers_test.assert_status(
  public.claim_writer_space(repeat('B', 42) || '2'), 'invalid',
  'failed recovery claim two returns invalid and commits its counter'
);
select writers_test.assert_status(
  public.claim_writer_space(repeat('B', 42) || '3'), 'invalid',
  'failed recovery claim three returns invalid and commits its counter'
);
select writers_test.assert_status(
  public.claim_writer_space(repeat('B', 42) || '4'), 'invalid',
  'failed recovery claim four returns invalid and commits its counter'
);
select writers_test.assert_status(
  public.claim_writer_space(repeat('B', 42) || '5'), 'rate_limited',
  'fifth failed recovery claim enters cooldown without raising'
);
select writers_test.assert_status(
  public.claim_writer_space(repeat('A', 43)), 'rate_limited',
  'cooldown blocks the valid recovery code'
);
reset role;

select writers_test.assert_true(
  (select failures from writers_private.recovery_claim_limits
   where user_id = '22222222-2222-4222-8222-222222222222'::uuid) = 5,
  'five failed recovery counters survived separate committed RPC statements'
);
select writers_test.assert_true(
  (select blocked_until > pg_catalog.now() from writers_private.recovery_claim_limits
   where user_id = '22222222-2222-4222-8222-222222222222'::uuid),
  'recovery limiter stores a future cooldown'
);

update writers_private.recovery_claim_limits
set blocked_until = pg_catalog.now() - interval '1 second'
where user_id = '22222222-2222-4222-8222-222222222222'::uuid;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
declare
  claim_result jsonb;
begin
  claim_result := public.claim_writer_space(repeat('A', 43));
  perform writers_test.assert_status(claim_result, 'ok', 'B can recover the space after cooldown expiry');
  perform writers_test.assert_true(
    pg_catalog.strpos(claim_result::text, repeat('A', 43)) = 0,
    'recovery result does not expose the recovery code'
  );
  perform writers_test.assert_status(
    public.get_writer_space_state(writers_test.space_id()),
    'ok',
    'B can read the recovered head only after claim membership'
  );
end;
$$;
select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 1,
  'B RLS exposes exactly the recovered writer space'
);
reset role;

select writers_test.assert_true(
  exists (
    select 1 from public.writer_space_memberships
    where user_id = '22222222-2222-4222-8222-222222222222'::uuid
      and joined_via = 'recovery'
  ),
  'recovery creates an auditable membership for auth.uid B'
);
select writers_test.assert_true(
  (select failures = 0 and blocked_until is null
   from writers_private.recovery_claim_limits
   where user_id = '22222222-2222-4222-8222-222222222222'::uuid),
  'successful recovery resets the limiter'
);

\echo 'Auth-reset orphan retention and no-cascade invariants'

select writers_test.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class child_table on child_table.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace child_schema on child_schema.oid = child_table.relnamespace
    join pg_catalog.pg_class parent_table on parent_table.oid = constraint_row.confrelid
    join pg_catalog.pg_namespace parent_schema on parent_schema.oid = parent_table.relnamespace
    where constraint_row.contype = 'f'
      and child_schema.nspname in ('public', 'writers_private')
      and child_table.relname like 'writer%'
      and parent_schema.nspname = 'auth'
  ),
  'writer history and memberships have no foreign key to auth users'
);
select writers_test.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class child_table on child_table.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace child_schema on child_schema.oid = child_table.relnamespace
    where constraint_row.contype = 'f'
      and constraint_row.confdeltype = 'c'
      and child_schema.nspname in ('public', 'writers_private')
      and (child_table.relname like 'writer%' or child_table.relname in (
        'recovery_secrets', 'recovery_claim_limits', 'sync_operations'
      ))
  ),
  'writer data has no ON DELETE CASCADE history-loss path'
);

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '', false);
select writers_test.assert_status(
  public.get_writer_space_state(writers_test.space_id()),
  'forbidden',
  'cleared auth identity cannot read the former device space'
);
reset role;

select writers_test.assert_true(
  (select pg_catalog.count(*) from public.writer_spaces) = 1
  and (select pg_catalog.count(*) from public.writer_snapshots) >= 6
  and (select pg_catalog.count(*) from public.writer_space_memberships) = 2,
  'auth identity reset leaves space, immutable history, and orphan-safe memberships intact'
);

\echo 'Harness summary'
select pg_catalog.count(*) as passed_assertions from writers_test.assertion_log;
select 'PASS: Writer''s Studio SQL/RPC/RLS harness completed' as result;

drop schema writers_test cascade;
