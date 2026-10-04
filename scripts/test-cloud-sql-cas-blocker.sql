\set ON_ERROR_STOP on

set statement_timeout = '35s';
begin;
select id
from public.writer_spaces
where lineage_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
for update;
select pg_catalog.pg_sleep(30);
commit;
