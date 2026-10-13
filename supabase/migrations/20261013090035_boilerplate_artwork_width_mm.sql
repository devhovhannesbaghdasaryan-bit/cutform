-- Physical width of the manufacturing canvas (the full square PNG, not the
-- cut panel) in millimetres. When set, the traced manufacturing SVG is
-- emitted in millimetres so laser software opens it at the right size; null
-- keeps the SVG in source pixels and the operator scales it by hand.
alter table "public"."personalization_boilerplates"
  add column "artwork_width_mm" numeric(7, 2);
