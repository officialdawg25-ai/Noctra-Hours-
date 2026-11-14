-- Noctra Hours admin platform: additive extension of the existing CMS foundation.
-- Reuses admin_content, admin_members, admin_roles, admin_permissions,
-- admin_role_permissions, admin_site_settings, admin_media_assets,
-- admin_content_revisions, admin_enquiry_notes and admin_audit_logs.
-- No existing content or enquiry rows are deleted or rewritten.

alter table public.admin_content_revisions
  add column if not exists revision_number integer not null default 1,
  add column if not exists change_note text not null default '';

create unique index if not exists admin_content_revisions_content_revision_uidx
  on public.admin_content_revisions(content_id, revision_number);

alter table public.admin_audit_logs
  add column if not exists outcome text not null default 'success',
  add column if not exists previous_values jsonb,
  add column if not exists new_values jsonb,
  add column if not exists request_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and conname = 'admin_audit_logs_outcome_check'
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_outcome_check
      check (outcome in ('success','failure','denied'));
  end if;
end $$;

alter table public.admin_media_assets
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.admin_members
  add column if not exists last_login_at timestamptz,
  add column if not exists suspended_at timestamptz;

alter table public.project_enquiries
  add column if not exists follow_up_at timestamptz;

create index if not exists idx_admin_content_resource_status_order
  on public.admin_content(resource, status, sort_order);
create index if not exists idx_admin_content_updated
  on public.admin_content(updated_at desc);
create index if not exists idx_admin_members_active
  on public.admin_members(active, role_id);
create index if not exists idx_project_enquiries_follow_up
  on public.project_enquiries(follow_up_at) where follow_up_at is not null;

create table if not exists public.admin_publication_history (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.admin_content(id) on delete cascade,
  resource text not null,
  action text not null check (action in ('submitted','approved','published','unpublished','archived','restored')),
  actor_id uuid references auth.users(id) on delete set null,
  revision_number integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_publication_history_content
  on public.admin_publication_history(content_id, created_at desc);

create table if not exists public.admin_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_url text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_path like '/%'),
  check (destination_url like '/%' or destination_url like 'https://%')
);

create index if not exists idx_admin_redirects_active
  on public.admin_redirects(is_active, source_path);

insert into public.admin_permissions(id, description) values
  ('website.manage','Manage website structure, navigation and homepage configuration'),
  ('seo.manage','Manage page metadata, redirects and indexing configuration'),
  ('business.manage','Manage business information and communication settings'),
  ('integrations.manage','Manage approved integration metadata and connection settings'),
  ('security.manage','Manage administrative security settings and sessions'),
  ('reports.read','View verified operational and enquiry reports'),
  ('content.submit','Submit content for review'),
  ('content.review','Review and approve content before publication')
on conflict (id) do update set description = excluded.description;

-- Preserve the existing role model and extend its permissions deliberately.
insert into public.admin_role_permissions(role_id, permission_id)
select r.id, p.id
from public.admin_roles r
cross join public.admin_permissions p
where r.name = 'super_administrator'
on conflict do nothing;

insert into public.admin_role_permissions(role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.id = any(array[
  'website.manage','seo.manage','business.manage','integrations.manage',
  'reports.read','content.review','content.submit'
])
where r.name = 'administrator'
on conflict do nothing;

insert into public.admin_role_permissions(role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.id = any(array[
  'seo.manage','content.submit'
])
where r.name = 'content_manager'
on conflict do nothing;

insert into public.admin_role_permissions(role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.id = any(array[
  'business.manage','reports.read'
])
where r.name = 'business_manager'
on conflict do nothing;

alter table public.admin_publication_history enable row level security;
alter table public.admin_redirects enable row level security;

revoke all on table public.admin_publication_history from public, anon, authenticated;
grant select, insert on table public.admin_publication_history to service_role;

revoke all on table public.admin_redirects from public, anon, authenticated;
grant all on table public.admin_redirects to service_role;

-- Administrative tables are accessed only through authenticated Pages Functions.
-- The browser never receives a service-role key or direct table privileges.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_roles','admin_permissions','admin_role_permissions','admin_members',
    'admin_content','admin_content_revisions','admin_enquiry_notes',
    'admin_media_assets','admin_site_settings','admin_audit_logs',
    'admin_publication_history','admin_redirects'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

-- History records are append-only. Only the server role may read or insert them.
revoke update, delete, truncate on table public.admin_audit_logs from public, anon, authenticated, service_role;
grant select, insert on table public.admin_audit_logs to service_role;
revoke update, delete, truncate on table public.admin_publication_history from public, anon, authenticated, service_role;
grant select, insert on table public.admin_publication_history to service_role;
