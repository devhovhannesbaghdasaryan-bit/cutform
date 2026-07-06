# Graph Report - .  (2026-07-06)

## Corpus Check
- Large corpus: 260 files · ~285,032 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 792 nodes · 1169 edges · 28 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 430 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Server Action Handlers|Server Action Handlers]]
- [[_COMMUNITY_Marketplace Requirements & Decisions|Marketplace Requirements & Decisions]]
- [[_COMMUNITY_Cart & Checkout Actions|Cart & Checkout Actions]]
- [[_COMMUNITY_Manufacturing Machine Capabilities|Manufacturing Machine Capabilities]]
- [[_COMMUNITY_Storefront UI & AI Generation|Storefront UI & AI Generation]]
- [[_COMMUNITY_Banner Generation & Credits|Banner Generation & Credits]]
- [[_COMMUNITY_Manufacturing & Product Docs|Manufacturing & Product Docs]]
- [[_COMMUNITY_Ameriabank Payment Integration|Ameriabank Payment Integration]]
- [[_COMMUNITY_Payments Plan & Design Docs|Payments Plan & Design Docs]]
- [[_COMMUNITY_Market & Country Resolution|Market & Country Resolution]]
- [[_COMMUNITY_Cart & Admin Data Layer|Cart & Admin Data Layer]]
- [[_COMMUNITY_Catalog Item Management|Catalog Item Management]]
- [[_COMMUNITY_Localization & Formatting|Localization & Formatting]]
- [[_COMMUNITY_E2E QA Workflow Scripts|E2E QA Workflow Scripts]]
- [[_COMMUNITY_OpenAI Boilerplate Storage Docs|OpenAI Boilerplate Storage Docs]]
- [[_COMMUNITY_Banner Manufacturing Engine|Banner Manufacturing Engine]]
- [[_COMMUNITY_Night-Light Product & Methods|Night-Light Product & Methods]]
- [[_COMMUNITY_Sheet Metal & Tube Bending|Sheet Metal & Tube Bending]]
- [[_COMMUNITY_Uniqraft Brand Assets|Uniqraft Brand Assets]]
- [[_COMMUNITY_Local Runtime QA Checks|Local Runtime QA Checks]]
- [[_COMMUNITY_Ameriabank Smoke Script|Ameriabank Smoke Script]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 129|Community 129]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 57 edges
2. `requireAdminPermission()` - 22 edges
3. `generatePersonalizedNightLightAction()` - 20 edges
4. `getServiceSupabase()` - 19 edges
5. `Marketplace MVP Requirements` - 18 edges
6. `Marketplace MVP Task List` - 18 edges
7. `updateCatalogItemAction()` - 14 edges
8. `getServerEnv()` - 14 edges
9. `Ameriabank Payments Plan` - 14 edges
10. `maybeSingle()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `SVG Sanitization (DOMPurify)` --semantically_similar_to--> `SVG Manufacturability Validation`  [INFERRED] [semantically similar]
  README.md → docs/design/mvp-marketplace-system-design.md
- `Tool Capability Schema` --references--> `manufacturing-schema.ts (canonical schema)`  [EXTRACTED]
  docs/manufacturing/tool-capability-schema.md → lib/manufacturing-schema.ts
- `Uniqraft App Icon` --semantically_similar_to--> `Uniqraft Apple Touch Icon`  [INFERRED] [semantically similar]
  app/icon.png → public/apple-touch-icon.png
- `Uniqraft App Icon` --semantically_similar_to--> `Uniqraft Favicon 32x32`  [INFERRED] [semantically similar]
  app/icon.png → public/favicon-32x32.png
- `Uniqraft Brand Mark` --semantically_similar_to--> `Uniqraft App Icon`  [INFERRED] [semantically similar]
  public/brand/uniqraft-mark.png → app/icon.png

## Hyperedges (group relationships)
- **Credit-Gated Generation and Charging** — mvp_marketplace_requirements_generation_flow, mvp_marketplace_decisions_credits, mvp_marketplace_system_design_credit_ledger, mvp_marketplace_system_design_night_light_pipeline, personalized_night_light_requirements_atomic_credit_debit [INFERRED 0.80]
- **Personalized Night-Light Feature** — personalized_night_light_requirements_boilerplate_options, personalized_night_light_requirements_initial_boilerplates, mvp_marketplace_requirements_personalized_night_light_flow, mvp_marketplace_decisions_personalized_night_lights, mvp_marketplace_system_design_generated_items [INFERRED 0.78]
- **Trilingual Localization (en/ru/am)** — mvp_marketplace_decisions_i18n, translation_review_checklist_i18n_terminology, translation_review_checklist_locale_fallback [INFERRED 0.80]
- **Ameriabank Payment Flow** — 2026_07_06_ameriabank_payments_vpos_gateway, 2026_07_06_ameriabank_payments_pure_vpos_core, 2026_07_06_ameriabank_payments_per_currency_payment_router, 2026_07_06_ameriabank_payments_callback_verification_route, 2026_07_06_ameriabank_payments_provider_agnostic_fulfillment, 2026_07_06_ameriabank_payments_decideoutcome_state_mapping [INFERRED 0.80]
- **Payment Routing Model Evolution** — 2026_07_06_ameriabank_payments_per_currency_payment_router, 2026_07_06_billing_country_payment_routing_resolvepaymentroute_function, 2026_07_06_billing_country_payment_routing_polar_merchant_of_record, 2026_07_06_ameriabank_payments_stripe_removal [INFERRED 0.70]
- **OpenAI File-ID Boilerplate Lifecycle** — 2026_07_06_openai_boilerplate_file_storage_openai_client_factory, 2026_07_06_openai_boilerplate_file_storage_reference_file_upload_delete, 2026_07_06_openai_boilerplate_file_storage_boilerplate_storage_migration, 2026_07_06_openai_boilerplate_file_storage_responses_api_image_generation, 2026_07_06_openai_boilerplate_file_storage_admin_boilerplate_actions [INFERRED 0.80]
- **Manufacturing AI skill pipeline over tools.json** — ai_skills_product_intake, ai_skills_tool_selection, ai_skills_manufacturability_check, ai_skills_file_preparation, ai_skills_quote_and_production_estimate, ai_skills_operator_checklist, ai_skills_learning_from_production [INFERRED 0.85]
- **Banner manufacturing instruction generation flow** — mvp_marketplace_tasks_banner_manufacturing_instructions, ai_skills, manufacturing_tools_json, tool_capability_schema, rag_manuals [INFERRED 0.90]
- **Multi-currency geographic commerce and payment routing** — mvp_marketplace_tasks_multi_currency_support, mvp_marketplace_tasks_currency_payment_routing, mvp_marketplace_tasks_amd_base_currency_decision, geographic_commerce_tasks [INFERRED 0.80]
- **Cutting Capability (laser, band saw, plotter)** — cut_with_3kw_fiber_laser_machine, cut_with_co2_laser_machine, cut_with_hx_260g_machine, cut_with_t48a_machine [INFERRED 0.75]
- **Printing Capability (FFF, UV, eco-solvent)** — print_with_bambulab_h2c_machine, print_with_l1s80_machine, print_with_t1_100_machine, print_with_flatbed_uv_machine, print_with_xt_3202_machine [INFERRED 0.75]
- **Bending Capability (sheet metal, tube/profile)** — bend_with_kcn_16025_machine, bend_with_rmb50_machine [INFERRED 0.70]

## Communities

### Community 0 - "Server Action Handlers"
Cohesion: 0.05
Nodes (48): actionError(), actionSuccess(), zodErrorToState(), adjustAdminUserCreditsAction(), adminTransactionAction(), callbackUrl(), createMarketRegionAction(), downloadAsDataUrl() (+40 more)

### Community 1 - "Marketplace Requirements & Decisions"
Cohesion: 0.04
Nodes (71): Product Documents Index, Geographic Commerce Requirements, Market Regions and ISO Country Codes, Order Rule Snapshotting, Commerce-Config RLS, Per-Item and Per-Region Shipping Rules, Marketplace MVP Product Decisions, Banner Production Presets (+63 more)

### Community 2 - "Cart & Checkout Actions"
Cohesion: 0.07
Nodes (40): addCatalogItemToCartAction(), addGeneratedItemToCartAction(), clearCartAction(), createCheckoutOrderAction(), createCreditPackCheckoutAction(), getCartActor(), getGeneratedSaleCurrency(), getGeneratedSalePriceCents() (+32 more)

### Community 3 - "Manufacturing Machine Capabilities"
Cohesion: 0.05
Nodes (47): Woodworking dust collector XC-7500 (Dust Collection), Wood, MDF, and plywood dust, Dust extraction and chip collection (support role), Fiber metal laser cutter with pipe cutter (Fiber Laser Cutting), Mild/stainless/aluminum/galvanized steel, brass/copper if optics allow, 3000 W fiber laser source (confirmed); bed and pipe capacity unknown, Fiber laser cutting of sheet and pipe/tube, marking, piercing, 1300x900 mm bed, 100 W CO2 tube (confirmed) (+39 more)

### Community 4 - "Storefront UI & AI Generation"
Cohesion: 0.07
Nodes (47): Generated Item Preview (Before Selection), Generated Item Result (AI Generation After State), AI Generation Feature, Generate Custom Item Action, Language Switcher (EN/RU/AM), Generated Night Light Preview, Created Variants Selector, Generation Configuration Panel (Type / Text / LED color / Prompt) (+39 more)

### Community 5 - "Banner Generation & Credits"
Cohesion: 0.08
Nodes (30): customizeBannerSampleAction(), errorState(), generateBannerAction(), generatePersonalizedNightLightAction(), uploadCustomizedBannerPreview(), uploadGeneratedBannerPreview(), uploadGeneratedPng(), uploadReferenceImage() (+22 more)

### Community 6 - "Manufacturing & Product Docs"
Cohesion: 0.07
Nodes (40): Manufacturing AI Skills, File Preparation Skill, Manufacturability Check Skill, Tool Selection Skill, Ameriabank vPOS Payments Design, Cyberpunk-Inspired Theming Tasks, Uniqraft Brand Logo Design QA, Generated Item UI Audit (+32 more)

### Community 7 - "Ameriabank Payment Integration"
Cohesion: 0.1
Nodes (25): buildInitPaymentBody(), buildPaymentDetailsBody(), buildPaymentPageUrl(), decideOutcome(), parseInitPaymentResponse(), parsePaymentDetailsResponse(), toMajorUnits(), fetchAmeriaPaymentDetails() (+17 more)

### Community 8 - "Payments Plan & Design Docs"
Cohesion: 0.09
Nodes (33): Admin Ameriabank Reconciliation, Ameriabank Payments Plan, Callback Params Untrusted Rationale, Callback Verification Route, decideOutcome State Mapping, Ameriabank Payments Design, DB-Authoritative Routing Rationale, Provider Abstraction Contract (+25 more)

### Community 9 - "Market & Country Resolution"
Cohesion: 0.1
Nodes (18): tDynamic(), findCountry(), normalizeCountryCode(), resolveCatalogMarket(), resolveCatalogMarkets(), resolveMarket(), getCatalogItem(), getCatalogItemSeoMetadata() (+10 more)

### Community 10 - "Cart & Admin Data Layer"
Cohesion: 0.1
Nodes (17): getAdminUserDetail(), listAdminUsers(), addItemToCart(), clearCart(), getActiveCartItemCount(), getNumericConfigurationValue(), getOrCreateCart(), getStringConfigurationValue() (+9 more)

### Community 11 - "Catalog Item Management"
Cohesion: 0.17
Nodes (22): createCatalogItemAction(), syncCatalogItemMarketRules(), updateCatalogItemAction(), uploadCatalogFormAssets(), upsertSeoMetadata(), validateCategoryExists(), validateSubcategoryBelongsToCategory(), buildToyDecorationDraftMetadata() (+14 more)

### Community 12 - "Localization & Formatting"
Cohesion: 0.11
Nodes (15): getDefaultLocaleForRegion(), getLocaleForFormatting(), isAppLocale(), normalizeLocale(), formatLocalizedCurrency(), formatLocalizedDate(), getRequestLocale(), getLocalePrefixedPath() (+7 more)

### Community 13 - "E2E QA Workflow Scripts"
Cohesion: 0.31
Nodes (16): assert(), bodyText(), checkInput(), clickByText(), connectBrowser(), evaluate(), fillInput(), login() (+8 more)

### Community 14 - "OpenAI Boilerplate Storage Docs"
Cohesion: 0.21
Nodes (14): Admin Boilerplate Actions, Boilerplate Storage Migration, File ID Cost Trade-Off, Official OpenAI SDK Decision, OpenAI Boilerplate Storage Design, Responses API Migration Rationale, No Backfill Rationale, OpenAI Boilerplate Storage Plan (+6 more)

### Community 15 - "Banner Manufacturing Engine"
Cohesion: 0.36
Nodes (9): buildBannerManufacturingInstructions(), buildDrawingDescription(), escapeSvgText(), getReviewWarnings(), loadKnowledgeBase(), loadManufacturingGuidance(), pickBannerPreset(), renderBannerManufacturingDrawing() (+1 more)

### Community 16 - "Night-Light Product & Methods"
Cohesion: 0.44
Nodes (9): Contour Laser-Engraved Night-Light (manufacturing reference), Laser Engraving (manufacturing method), UV Printing (manufacturing method), Personalized Bunny Night-Light (UV-printed, 'Sabrina'), Personalized Halloween Night-Light (UV-printed ghosts), Personalized Portrait Night-Light (couple photo, laser-engraved), Personalized Night-Light (product concept), Rectangular UV-Print Night-Light Blank (manufacturing reference) (+1 more)

### Community 17 - "Sheet Metal & Tube Bending"
Cohesion: 0.25
Nodes (8): 1600 kN max pressing force, 2500 mm working table, Hydraulic press brake KCN-16025 (Sheet Metal Bending), Sheet metals: mild steel, stainless, aluminum, Sheet metal bending process (air/bottom bending, flanging, box/pan), 60 mm round / 40x40x3 mm rectangular tube capacity, 50 mm shaft, Tube/profile bending machine RMB50 (Tube Bending), Mild steel/aluminum/stainless tube and rectangular profile, Tube bending process (tube rolling, profile bending, arc forming)

### Community 18 - "Uniqraft Brand Assets"
Cohesion: 0.52
Nodes (7): Uniqraft Apple Touch Icon, Uniqraft Brand Identity, Uniqraft Favicon 32x32, Uniqraft App Icon, Uniqraft Dark Logo Wordmark, Uniqraft Light Logo Wordmark, Uniqraft Brand Mark

### Community 20 - "Local Runtime QA Checks"
Cohesion: 0.7
Nodes (4): assert(), assertMetadata(), assertRoute(), fetchPage()

### Community 23 - "Ameriabank Smoke Script"
Cohesion: 0.67
Nodes (2): assert(), postJson()

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (2): snapshot(), userItem()

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (2): preflightSvg(), sanitizeSvg()

### Community 129 - "Community 129"
Cohesion: 1.0
Nodes (1): Product Intake Skill

### Community 130 - "Community 130"
Cohesion: 1.0
Nodes (1): Quote And Production Estimate Skill

### Community 131 - "Community 131"
Cohesion: 1.0
Nodes (1): Operator Checklist Skill

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (1): Learning From Production Skill

### Community 133 - "Community 133"
Cohesion: 1.0
Nodes (1): Snip account confirmation email (Supabase auth template)

## Ambiguous Edges - Review These
- `Marketplace MVP Requirements` → `CPSC Small-Parts Safety Rule`  [AMBIGUOUS]
  docs/investigations/wood-laser-cut-product-investigation.md · relation: conceptually_related_to

## Knowledge Gaps
- **98 isolated node(s):** `Resend SMTP Email Delivery`, `Scoped Admin Permissions`, `Configurable Boilerplate Options`, `Atomic Per-Selection Credit Debit and Refund`, `Append-Only Transaction Ledger` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Ameriabank Smoke Script`** (4 nodes): `assert()`, `loadEnvFile()`, `postJson()`, `payments-ameria.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `snapshot()`, `userItem()`, `cart-merge.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (3 nodes): `sanitize.ts`, `preflightSvg()`, `sanitizeSvg()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (1 nodes): `Product Intake Skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (1 nodes): `Quote And Production Estimate Skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `Operator Checklist Skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (1 nodes): `Learning From Production Skill`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 133`** (1 nodes): `Snip account confirmation email (Supabase auth template)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Marketplace MVP Requirements` and `CPSC Small-Parts Safety Rule`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `GET()` connect `Server Action Handlers` to `Cart & Checkout Actions`, `Banner Generation & Credits`, `Ameriabank Payment Integration`, `Market & Country Resolution`, `Cart & Admin Data Layer`, `Catalog Item Management`, `Localization & Formatting`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `generatePersonalizedNightLightAction()` connect `Banner Generation & Credits` to `Server Action Handlers`, `Cart & Admin Data Layer`, `Cart & Checkout Actions`, `Ameriabank Payment Integration`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `requireAdminPermission()` connect `Server Action Handlers` to `Catalog Item Management`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 55 inferred relationships involving `GET()` (e.g. with `addGeneratedItemToCartAction()` and `getFile()`) actually correct?**
  _`GET()` has 55 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `requireAdminPermission()` (e.g. with `savePersonalizationModelAction()` and `savePersonalizationBoilerplateAction()`) actually correct?**
  _`requireAdminPermission()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `generatePersonalizedNightLightAction()` (e.g. with `GET()` and `getImageFiles()`) actually correct?**
  _`generatePersonalizedNightLightAction()` has 16 INFERRED edges - model-reasoned connections that need verification._