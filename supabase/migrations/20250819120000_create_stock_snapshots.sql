-- 1C stock snapshot tables.
-- Historical stock levels by import date; sku_items remains the SKU master catalog.
-- Access: server-side only via SUPABASE_SECRET_KEY (service role).

create table if not exists public.stock_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null default '1c',
  stock_date date not null,
  file_name text,
  file_hash text not null,
  status text not null default 'committed',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  unmatched_rows integer not null default 0,
  total_stock integer not null default 0,
  total_accepted integer not null default 0,
  total_packed integer not null default 0,
  created_at timestamptz not null default now(),
  constraint stock_imports_source_date_hash_unique unique (source, stock_date, file_hash)
);

create table if not exists public.sku_stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  stock_import_id uuid not null references public.stock_imports (id) on delete cascade,
  sku_item_id uuid references public.sku_items (id) on delete set null,
  barcode text not null,
  nomenclature_raw text,
  characteristic_raw text,
  stock_total integer not null,
  stock_accepted integer not null,
  stock_packed integer not null,
  match_status text not null,
  stock_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists sku_stock_snapshots_import_id_idx
  on public.sku_stock_snapshots (stock_import_id);

create index if not exists sku_stock_snapshots_barcode_idx
  on public.sku_stock_snapshots (barcode);

create index if not exists sku_stock_snapshots_stock_date_idx
  on public.sku_stock_snapshots (stock_date desc);

create index if not exists sku_stock_snapshots_sku_item_id_idx
  on public.sku_stock_snapshots (sku_item_id);

create index if not exists stock_imports_stock_date_idx
  on public.stock_imports (stock_date desc);

create index if not exists stock_imports_created_at_idx
  on public.stock_imports (created_at desc);

alter table public.stock_imports enable row level security;
alter table public.sku_stock_snapshots enable row level security;
