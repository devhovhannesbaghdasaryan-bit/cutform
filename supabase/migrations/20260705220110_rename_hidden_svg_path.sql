-- Phase 16: rename misleading column hidden_svg_path -> manufacturing_file_path.
-- The column stores manufacturing PNG storage paths (not SVGs) on all three tables.
-- No indexes, constraints, views, policies, or functions reference the old name
-- (verified against pg_catalog), so plain column renames are sufficient.
-- Note: generated_item_artifacts.artifact_type check values ('hidden_svg',
-- 'manufacturing_svg') are stored data values and are intentionally untouched.

alter table public.generated_items
  rename column hidden_svg_path to manufacturing_file_path;

alter table public.personalized_preview_options
  rename column hidden_svg_path to manufacturing_file_path;

alter table public.order_items
  rename column hidden_svg_path to manufacturing_file_path;
