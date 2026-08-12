-- SKU directory tables for 1C nomenclature imports.
-- Access: server-side only via SUPABASE_SECRET_KEY (service role).
-- RLS is enabled with no public policies; the browser must not query these tables directly.
-- User authentication policies can be added later when auth is wired up.

create table if not exists public.sku_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null default '1c',
  file_name text,
  imported_at timestamptz not null default now(),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  matched_all integer not null default 0,
  matched_wb_only integer not null default 0,
  matched_ozon_only integer not null default 0,
  unmatched integer not null default 0,
  ambiguous integer not null default 0,
  coverage_percent numeric(5, 2),
  status text not null,
  error_count integer not null default 0,
  added_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  preview_payload jsonb
);

create table if not exists public.sku_items (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  article text,
  product_name text,
  nomenclature_raw text,
  characteristic_raw text,
  color text,
  size text,
  wb_nmid bigint,
  wb_vendor_code text,
  ozon_product_id bigint,
  ozon_offer_id text,
  match_status text not null,
  match_method text not null default 'barcode',
  warnings jsonb not null default '[]'::jsonb,
  import_id uuid references public.sku_imports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sku_items_barcode_unique unique (barcode)
);

create index if not exists sku_items_article_idx on public.sku_items (article);
create index if not exists sku_items_wb_nmid_idx on public.sku_items (wb_nmid);
create index if not exists sku_items_ozon_product_id_idx on public.sku_items (ozon_product_id);
create index if not exists sku_items_match_status_idx on public.sku_items (match_status);
create index if not exists sku_items_import_id_idx on public.sku_items (import_id);

create or replace function public.set_sku_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sku_items_set_updated_at on public.sku_items;

create trigger sku_items_set_updated_at
before update on public.sku_items
for each row
execute function public.set_sku_items_updated_at();

alter table public.sku_imports enable row level security;
alter table public.sku_items enable row level security;

-- No policies for anon/authenticated roles: only service role (server secret key) may access.
