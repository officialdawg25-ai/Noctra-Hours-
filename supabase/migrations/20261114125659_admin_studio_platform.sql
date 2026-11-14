-- Noctra Hours administration and CMS foundation.
-- Existing authentication and project_enquiries remain the single identity and enquiry systems.
-- Privileged administration tables are accessed only by server-side Pages Functions.
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_permissions (
  id text primary key,
  description text not null
);
create table if not exists public.admin_role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id text not null references public.admin_permissions(id) on delete cascade,
  primary key(role_id, permission_id)
);
create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id),
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_content (
  id uuid primary key default gen_random_uuid(),
  resource text not null check (resource in ('industries','services','capabilities','projects','ventures','testimonials','pages','navigation')),
  title text not null,
  slug text not null,
  summary text not null default '',
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  sort_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(resource, slug)
);
create index if not exists admin_content_resource_status_order_idx on public.admin_content(resource,status,sort_order);
create index if not exists admin_content_updated_at_idx on public.admin_content(updated_at desc);
create table if not exists public.admin_content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.admin_content(id) on delete cascade,
  resource text not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists admin_content_revisions_content_idx on public.admin_content_revisions(content_id,created_at desc);
create table if not exists public.admin_site_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  bucket text not null default 'noctra-media',
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check(file_size >= 0),
  alt_text text not null default '',
  caption text not null default '',
  category text not null default 'general',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);

-- Extend the existing enquiry workflow rather than creating a duplicate lead database.
alter table public.project_enquiries
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists admin_updated_at timestamptz not null default now();
alter table public.project_enquiries drop constraint if exists project_enquiries_status_check;
alter table public.project_enquiries add constraint project_enquiries_status_check
  check (status in ('received','reviewing','consultation','proposal','accepted','onboarding','closed',
                    'new','reviewed','contacted','qualified','proposal_sent','in_progress','won','lost','archived'));
create index if not exists project_enquiries_status_created_idx on public.project_enquiries(status,created_at desc);

create table if not exists public.admin_enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.project_enquiries(id) on delete cascade,
  note text not null check(length(note) between 1 and 5000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists admin_enquiry_notes_enquiry_idx on public.admin_enquiry_notes(enquiry_id,created_at desc);

insert into public.admin_permissions(id,description) values
 ('content.read','Read website content'),
 ('content.write','Create and edit website content'),
 ('content.publish','Publish and unpublish website content'),
 ('settings.manage','Manage website and business settings'),
 ('media.manage','Manage media assets'),
 ('enquiries.read','Read project enquiries'),
 ('enquiries.manage','Manage enquiries and assignments'),
 ('users.manage','Invite administrators and manage roles'),
 ('audit.read','Read administrative audit history')
on conflict(id) do nothing;
insert into public.admin_roles(name,description,is_system) values
 ('super_administrator','Full platform authority',true),
 ('administrator','Website and business administration',true),
 ('content_manager','Website content and media management',true),
 ('business_manager','Enquiry and business operations management',true)
on conflict(name) do nothing;
insert into public.admin_role_permissions(role_id,permission_id)
select r.id,p.id from public.admin_roles r cross join public.admin_permissions p
where r.name='super_administrator' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_id)
select r.id,p.id from public.admin_roles r join public.admin_permissions p on p.id in
 ('content.read','content.write','content.publish','settings.manage','media.manage','enquiries.read','enquiries.manage','audit.read')
where r.name='administrator' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_id)
select r.id,p.id from public.admin_roles r join public.admin_permissions p on p.id in
 ('content.read','content.write','media.manage')
where r.name='content_manager' on conflict do nothing;
insert into public.admin_role_permissions(role_id,permission_id)
select r.id,p.id from public.admin_roles r join public.admin_permissions p on p.id in
 ('enquiries.read','enquiries.manage')
where r.name='business_manager' on conflict do nothing;

-- Initial industry positioning is a service taxonomy, not a claim of completed client work.
insert into public.admin_content(resource,title,slug,summary,status,sort_order,data) values
 ('industries','Commerce & Retail','commerce-retail','Digital storefronts, ecommerce and unified commerce systems.','published',1,'{"positioning":"areas_we_support","related_solutions":["Ecommerce websites","Product catalogues","Commerce systems"]}'),
 ('industries','Hospitality & Living','hospitality-living','Booking experiences, property platforms and guest management.','published',2,'{"positioning":"areas_we_support","related_solutions":["Booking platforms","Accommodation websites","Property systems"]}'),
 ('industries','Beauty & Personal Care','beauty-personal-care','Brand experiences, online stores and customer engagement.','published',3,'{"positioning":"areas_we_support","related_solutions":["Brand websites","Online stores","Customer engagement"]}'),
 ('industries','Professional Services','professional-services','Business websites, client portals and business automation.','published',4,'{"positioning":"areas_we_support","related_solutions":["Corporate websites","Client portals","Business automation"]}'),
 ('industries','Education & Institutions','education-institutions','Learning platforms, administration and digital communication.','published',5,'{"positioning":"areas_we_support","related_solutions":["Learning platforms","Administration portals","Digital communication"]}'),
 ('industries','Technology & Innovation','technology-innovation','Web applications, automation and connected digital products.','published',6,'{"positioning":"areas_we_support","related_solutions":["Web applications","Workflow automation","Connected products"]}')
on conflict(resource,slug) do nothing;
insert into public.admin_site_settings(key,value) values
 ('site_identity','{"name":"Noctra Hours","tagline":"Digital infrastructure for ambitious businesses.","font_family":"Arial"}'),
 ('homepage_sections','{"industries":true,"services":true,"capabilities":true,"selected_work":true,"ventures":true}'),
 ('seo_defaults','{"title":"Noctra Hours | Digital Development Studio","description":"Digital infrastructure for ambitious businesses."}')
on conflict(key) do nothing;

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_content enable row level security;
alter table public.admin_content_revisions enable row level security;
alter table public.admin_site_settings enable row level security;
alter table public.admin_media_assets enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_enquiry_notes enable row level security;
revoke all on public.admin_roles,public.admin_permissions,public.admin_role_permissions,public.admin_members,
 public.admin_content,public.admin_content_revisions,public.admin_site_settings,public.admin_media_assets,
 public.admin_audit_logs,public.admin_enquiry_notes from public,anon,authenticated;
grant all on public.admin_roles,public.admin_permissions,public.admin_role_permissions,public.admin_members,
 public.admin_content,public.admin_content_revisions,public.admin_site_settings,public.admin_media_assets,
 public.admin_audit_logs,public.admin_enquiry_notes to service_role;
grant usage,select on sequence public.admin_audit_logs_id_seq to service_role;

-- Publicly readable media only; uploads and deletes are performed by server-side service_role code.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('noctra-media','noctra-media',true,12582912,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=12582912,allowed_mime_types=excluded.allowed_mime_types;
