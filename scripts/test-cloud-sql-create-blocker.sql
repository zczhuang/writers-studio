\set ON_ERROR_STOP on

set statement_timeout = '35s';
begin;
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(pg_catalog.repeat('A', 43), 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    0
  )
);
select pg_catalog.pg_sleep(30);
commit;
