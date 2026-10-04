import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationPath = join(process.cwd(), 'supabase', 'migrations', '202610030001_writers_studio_cloud_history.sql');
const sql = readFileSync(migrationPath, 'utf8');

const publicTables = [
  'writer_spaces',
  'writer_space_memberships',
  'writer_snapshots',
  'writer_entry_versions',
  'writer_progress_events',
  'writer_legacy_baselines',
];

const rpcs = [
  'get_writer_space_state',
  'create_writer_space',
  'sync_writer_space',
  'claim_writer_space',
];

function functionBlock(name) {
  const pattern = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, 'i');
  const match = sql.match(pattern);
  assert.ok(match, `missing function ${name}`);
  return match[0];
}

test('all exposed history tables use membership-scoped read-only RLS', () => {
  for (const table of publicTables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, 'i'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`, 'i'));
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated;`, 'i'));
  }
  assert.doesNotMatch(sql, /create policy[\s\S]{0,200}for (insert|update|delete|all)/i);
  assert.match(sql, /membership\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on schema writers_private from public, anon, authenticated;/i);
  assert.match(sql, /revoke all on all tables in schema writers_private from public, anon, authenticated;/i);
});

test('every callable RPC is a fixed-search-path definer with auth checks and exact grants', () => {
  for (const rpc of rpcs) {
    const block = functionBlock(rpc);
    assert.match(block, /security definer/i);
    assert.match(block, /set search_path = ''/i);
    assert.match(block, /auth\.uid\(\)/i);
    assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}\\(`, 'i'));
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}\\(`, 'i'));
  }
  assert.match(functionBlock('get_writer_space_state'), /member_can_access\(p_space_id, caller\)/i);
  assert.match(functionBlock('sync_writer_space'), /member_can_access\(p_space_id, caller\)/i);
  assert.match(functionBlock('claim_writer_space'), /member_can_access\(claimed_space_id, caller\)/i);
  assert.match(functionBlock('create_writer_space'), /member_can_access\(space_row\.id, caller\)/i);
});

test('recovery hashes stay private and failed claims commit before returning rate limits', () => {
  assert.match(sql, /create table writers_private\.recovery_secrets/i);
  assert.doesNotMatch(sql, /create table public\.[^(\s]+[\s\S]{0,300}recovery_hash/i);
  assert.match(sql, /extensions\.digest\(pg_catalog\.convert_to\(p_recovery_code, 'UTF8'\), 'sha256'\)/i);
  const claim = functionBlock('claim_writer_space');
  assert.match(claim, /update writers_private\.recovery_claim_limits[\s\S]*failures = next_failures/i);
  assert.match(claim, /return pg_catalog\.jsonb_build_object\('status', 'invalid'\)/i);
  assert.doesNotMatch(claim, /raise exception/i);
  assert.match(claim, /next_failures >= 5/i);
});

test('snapshots, entry versions, events, and baselines are append-only and never truncated at 500', () => {
  for (const trigger of [
    'writer_snapshots_immutable',
    'writer_entry_versions_immutable',
    'writer_progress_events_immutable',
    'writer_legacy_baselines_immutable',
  ]) assert.match(sql, new RegExp(`create trigger ${trigger}`, 'i'));
  assert.match(sql, /before update or delete on public\.writer_snapshots/i);
  assert.match(sql, /jsonb_array_length\(p_payload -> 'entries'\)\s*>\s*10000/i);
  assert.doesNotMatch(sql, /limit\s+500\b/i);
});

test('sync RPC enforces generation, idempotency, CAS conflict backup, non-dropping heads, and terminal ledgers', () => {
  const sync = functionBlock('sync_writer_space');
  assert.match(sync, /p_generation is null/i);
  assert.match(sync, /p_expected_version is null/i);
  assert.match(sync, /space_row\.generation is distinct from p_generation/i);
  assert.match(sync, /prior_op\.request_hash is distinct from request_hash/i);
  assert.match(sync, /p_expected_version is distinct from space_row\.head_version/i);
  assert.match(sync, /'conflict'/i);
  assert.match(sync, /record_payload_history/i);
  assert.match(sql, /unique \(space_id, operation_id\)/i);
  assert.match(sql, /return 'entry_loss'/i);
  assert.match(sql, /return 'ledger_loss'/i);
  assert.match(sql, /return 'terminal_ledger_changed'/i);
  assert.match(sql, /return 'counter_regression'/i);
  assert.match(sql, /return 'empty_rejected'/i);
});

test('server rejects secret and ephemeral fields in cloud payloads', () => {
  for (const key of [
    'geminiapikey',
    'parentpinhash',
    'parentpinsalt',
    'parentunlockeduntil',
    'navstack',
    'recoverycode',
    'accesstoken',
    'refreshtoken',
  ]) assert.match(sql, new RegExp(`'${key}'`));
  assert.match(sql, /lower\(pg_catalog\.regexp_replace\(field_name, '\[_-\]', '', 'g'\)\)/i);
  assert.match(sql, /jsonb_contains_forbidden_field\(child\)/i);
});

test('create and sync retain additive canonical proof arguments and private grants', () => {
  for (const rpc of ['create_writer_space', 'sync_writer_space']) {
    assert.match(functionBlock(rpc), /p_payload_canonical text default null/i);
  }
  assert.match(
    sql,
    /grant execute on function public\.create_writer_space\(uuid, uuid, text, uuid, jsonb, text, jsonb, text\) to authenticated;/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.sync_writer_space\(uuid, uuid, bigint, uuid, jsonb, text, jsonb, text\) to authenticated;/i,
  );
  assert.match(sql, /revoke all on all functions in schema writers_private from public, anon, authenticated;/i);
});
