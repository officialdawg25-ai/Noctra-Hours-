create table if not exists public.enquiry_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null
);

alter table public.enquiry_rate_limits enable row level security;
revoke all on table public.enquiry_rate_limits from public, anon, authenticated;
grant all on table public.enquiry_rate_limits to service_role;

create or replace function public.consume_enquiry_rate_limit(
  p_key text,
  p_window_seconds integer default 60,
  p_max_requests integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_key is null or length(p_key) < 32 or length(p_key) > 128
     or p_window_seconds < 1 or p_window_seconds > 3600
     or p_max_requests < 1 or p_max_requests > 100 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.enquiry_rate_limits(rate_key, window_started_at, request_count, expires_at)
  values (p_key, v_now, 1, v_now + make_interval(secs => p_window_seconds * 2))
  on conflict (rate_key) do update
    set window_started_at = case
          when public.enquiry_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then v_now else public.enquiry_rate_limits.window_started_at end,
        request_count = case
          when public.enquiry_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then 1 else public.enquiry_rate_limits.request_count + 1 end,
        expires_at = v_now + make_interval(secs => p_window_seconds * 2)
  returning request_count into v_count;

  delete from public.enquiry_rate_limits
  where expires_at < v_now
    and rate_key <> p_key;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_enquiry_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_enquiry_rate_limit(text, integer, integer) to service_role;
