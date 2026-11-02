-- Server-only Shopify storage. Apply after 001_initial.sql in Supabase SQL editor.
-- No Shopify token, app secret, customer record or staff identity is persisted.
create table if not exists public.shopify_stores (
  id text primary key check (id ~ '^gid://shopify/Shop/[0-9]+$'),
  domain text not null unique check (domain ~ '^[a-z0-9][a-z0-9-]*[.]myshopify[.]com$'),
  name text not null,
  currency text not null,
  status text not null default 'connected' check (status in ('connected','uninstalled')),
  brand jsonb not null default '{}'::jsonb check (octet_length(brand::text) < 400000),
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.shopify_kits (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.shopify_stores(id) on delete cascade,
  product_id text not null check (product_id ~ '^gid://shopify/Product/[0-9]+$'),
  variant_id text not null check (variant_id ~ '^gid://shopify/ProductVariant/[0-9]+$'),
  project jsonb not null check (octet_length(project::text) < 2500000),
  link jsonb not null,
  revision integer not null default 1 check (revision > 0),
  stale boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists shopify_kits_store_updated on public.shopify_kits(store_id, updated_at desc);
create index if not exists shopify_kits_store_product on public.shopify_kits(store_id, product_id);
create table if not exists public.shopify_description_history (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.shopify_stores(id) on delete cascade,
  product_id text not null,
  before_html text not null check (octet_length(before_html) < 1000000),
  after_html text not null check (octet_length(after_html) < 1000000),
  before_text text not null,
  after_text text not null,
  status text not null default 'pending' check (status in ('pending','applying','applied','conflict','uncertain')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists shopify_history_product on public.shopify_description_history(store_id, product_id, created_at desc);
create table if not exists public.shopify_ai_usage (
  store_id text not null references public.shopify_stores(id) on delete cascade,
  month date not null,
  count integer not null default 0 check (count >= 0),
  primary key(store_id, month)
);
create table if not exists public.shopify_ai_global_usage (
  month date primary key,
  count integer not null default 0 check (count >= 0)
);
-- Only non-identifying delivery metadata is retained for durable idempotency.
create table if not exists public.shopify_webhook_receipts (
  event_id text primary key check (length(event_id) between 1 and 200),
  topic text not null,
  processed_at timestamptz not null default now()
);

alter table public.shopify_stores enable row level security;
alter table public.shopify_kits enable row level security;
alter table public.shopify_description_history enable row level security;
alter table public.shopify_ai_usage enable row level security;
alter table public.shopify_ai_global_usage enable row level security;
alter table public.shopify_webhook_receipts enable row level security;
revoke all on public.shopify_stores, public.shopify_kits, public.shopify_description_history, public.shopify_ai_usage, public.shopify_ai_global_usage, public.shopify_webhook_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.shopify_stores, public.shopify_kits, public.shopify_description_history, public.shopify_ai_usage, public.shopify_ai_global_usage, public.shopify_webhook_receipts to service_role;

create or replace function public.studioshelf_save_shopify_kit(p_store_id text, p_product_id text, p_variant_id text, p_project jsonb, p_link jsonb, p_stale boolean, p_id uuid default null, p_expected_revision integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.shopify_kits;
begin
  if not exists(select 1 from public.shopify_stores where id=p_store_id and status='connected') then
    raise sqlstate 'PT403' using message='Store is not connected';
  end if;
  if p_id is null then
    insert into public.shopify_kits(store_id,product_id,variant_id,project,link,stale)
    values(p_store_id,p_product_id,p_variant_id,p_project,p_link,p_stale) returning * into result;
  else
    update public.shopify_kits set product_id=p_product_id,variant_id=p_variant_id,project=p_project,link=p_link,stale=p_stale,revision=revision+1,updated_at=now()
    where id=p_id and store_id=p_store_id and revision=p_expected_revision returning * into result;
    if not found then raise sqlstate 'PT409' using message='Kit changed or unavailable'; end if;
  end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.studioshelf_save_shopify_kit(text,text,text,jsonb,jsonb,boolean,uuid,integer) from public, anon, authenticated;
grant execute on function public.studioshelf_save_shopify_kit(text,text,text,jsonb,jsonb,boolean,uuid,integer) to service_role;

create or replace function public.studioshelf_reserve_shopify_ai(p_store_id text, p_limit integer, p_global_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m date := date_trunc('month',now() at time zone 'utc')::date; used integer; global_used integer;
begin
  if p_limit < 1 or p_limit > 10000 or p_global_limit < 1 or p_global_limit > 1000000 then
    raise sqlstate 'PT403' using message='Hosted generation disabled';
  end if;
  if not exists(select 1 from public.shopify_stores where id=p_store_id and status='connected') then
    raise sqlstate 'PT403' using message='Store is not connected';
  end if;
  -- Lock global first on every reservation so concurrent stores cannot overspend.
  insert into public.shopify_ai_global_usage(month,count) values(m,0) on conflict do nothing;
  select count into global_used from public.shopify_ai_global_usage where month=m for update;
  insert into public.shopify_ai_usage(store_id,month,count) values(p_store_id,m,0) on conflict do nothing;
  select count into used from public.shopify_ai_usage where store_id=p_store_id and month=m for update;
  if used >= p_limit or global_used >= p_global_limit then
    return jsonb_build_object('allowed',false,'used',used,'remaining',greatest(0,p_limit-used),'limit',p_limit);
  end if;
  update public.shopify_ai_usage set count=count+1 where store_id=p_store_id and month=m;
  update public.shopify_ai_global_usage set count=count+1 where month=m;
  return jsonb_build_object('allowed',true,'used',used+1,'remaining',p_limit-used-1,'limit',p_limit);
end;
$$;
revoke all on function public.studioshelf_reserve_shopify_ai(text,integer,integer) from public, anon, authenticated;
grant execute on function public.studioshelf_reserve_shopify_ai(text,integer,integer) to service_role;

create or replace function public.studioshelf_shopify_webhook(p_event_id text, p_topic text, p_shop text, p_product_id text default null, p_store_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare sid text;
begin
  insert into public.shopify_webhook_receipts(event_id,topic) values(p_event_id,p_topic) on conflict do nothing;
  if not found then return; end if;
  select id into sid from public.shopify_stores where domain=p_shop for update;
  if sid is not null and p_store_id is not null and sid <> p_store_id then
    raise sqlstate 'PT400' using message='Webhook store identity mismatch';
  end if;
  if p_topic='shop/redact' then
    delete from public.shopify_stores where id=sid; -- cascades all store content/history/branding/usage
  elsif p_topic='app/uninstalled' then
    update public.shopify_stores set status='uninstalled', brand='{}'::jsonb, scopes='{}', updated_at=now() where id=sid;
    delete from public.shopify_kits where store_id=sid;
    delete from public.shopify_description_history where store_id=sid;
    -- Keep non-personal monthly counters until shop/redact to prevent quota reset on reinstall.
  elsif p_topic='app/scopes_update' then
    -- Effective staff scopes are re-exchanged and checked on every API call.
    update public.shopify_stores set scopes='{}', updated_at=now() where id=sid;
  elsif p_topic='products/update' then
    update public.shopify_kits set stale=true where store_id=sid and product_id=p_product_id;
  elsif p_topic in ('customers/data_request','customers/redact') then
    -- No customer data is collected. Acknowledge only the receipt; discard request body.
    null;
  else
    raise sqlstate 'PT400' using message='Unsupported webhook topic';
  end if;
end;
$$;
revoke all on function public.studioshelf_shopify_webhook(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.studioshelf_shopify_webhook(text,text,text,text,text) to service_role;
