-- Immutable server-side audit trail for administrative actions.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  status text not null default 'success' check (status in ('success', 'failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_actor_id_idx
  on public.admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs(target_type, target_id);

alter table public.admin_audit_logs enable row level security;

-- No client policies are created. Reads and writes are only performed by
-- authenticated server actions after role verification, using the service role.

revoke all on table public.admin_audit_logs from anon, authenticated;
