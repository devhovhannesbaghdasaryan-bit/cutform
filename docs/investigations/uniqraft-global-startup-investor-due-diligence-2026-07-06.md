# Uniqraft Global Startup Investigation and Investor Stress Test

Date: 2026-07-06  
Perspective: global market, not Armenia-only  
Status: strategy research, not legal, tax, or investment advice

## 1. What startup is being evaluated

The repository currently describes several products at once: a catalog marketplace, an AI image-to-SVG generator, personalized night lights, banners, laser-cut toys/decor/constructors, credits, payments, and a workshop with multiple production technologies.

The strongest coherent version of the startup is:

> **Uniqraft turns a customer's photo, prompt, or constrained customization into a reviewed, manufacturable product and routes it to a qualified factory for local or regional fulfillment.**

The initial wedge should be photo-to-product personalized light and wall decor. The long-term platform can become a design-to-manufacturing operating layer for custom-product merchants and factories.

That formulation matters. “A marketplace for many crafts” is not a focused startup. “AI personalized gifts” is easy to copy. “A category-specific design-for-manufacturing system whose files get better from real production outcomes” can become defensible.

### What the code proves—and does not prove

The product already has meaningful global-commerce intent:

- All ISO countries are seeded into five regions.
- Catalog visibility and shipping can be controlled by country or region.
- AMD, EUR, USD, and RUB are modeled.
- Checkout totals are recalculated server-side and orders snapshot shipping and exchange-rate context.
- The product catalog already spans night lights, laser-cut toys, decorations, constructors, and banners.

But global UI is not global operations. The current requirements explicitly leave taxes out of scope and retain incomplete shipping behavior for generated items and banners. Four displayed currencies, country selection, and a global catalog do not solve duties, VAT, returns, product compliance, regional payment acceptance, delivery promises, or local manufacturing quality.

Repository evidence: `lib/currency.ts`, `lib/market.ts`, `lib/shipping.ts`, `lib/marketplace-constants.ts`, `docs/requirements/geographic-commerce-requirements.md`, and `supabase/migrations/20260704091247_geographic_catalog_currency_shipping.sql`.

## 2. Executive verdict

### Hostile investment-committee verdict today

**Pass today; invite the founder back after focused validation.**

The idea is attractive as a bootstrapped personalized-products business and potentially venture-scale as a B2B2C design-to-production network. It is not yet investable as a broad marketplace. The current thesis has product sprawl, no evidenced paid traction in the materials reviewed, unproven unit economics, a weak initial moat, and major global-operations obligations that the current product model does not yet cover.

### What would change the decision

An investor should reconsider after Uniqraft demonstrates all of the following in one narrow product family:

1. At least 100 paid orders from at least three countries, not free generations or sign-ups.
2. At least 35% contribution margin after payment fees, AI, review labor, materials, failed production, packaging, shipping subsidies, refunds, and support.
3. At least 85% first-pass generation approval for constrained templates and under 10 minutes median human correction.
4. Under 5% remake/refund rate and at least 95% on-time dispatch.
5. A repeatable acquisition channel with a payback period under three months or strong organic/referral evidence.
6. One successful regional manufacturing-partner pilot producing the same SKU within defined tolerances.
7. A documented compliance path for each launch market and product class.

### Scorecard

| Dimension | Current assessment | Investor reading |
|---|---:|---|
| Customer pain | 7/10 | Custom product design and production handoffs are genuinely slow and manual. |
| Market evidence | 8/10 | Etsy alone reports roughly 30% of $10.46B 2025 marketplace GMS as custom or made-to-order. |
| Product focus | 3/10 | Too many categories and business models are active at once. |
| Technical feasibility | 6/10 | Constrained 2D products are feasible; arbitrary image-to-manufacturable-object is not reliably solved. |
| Global readiness | 3/10 | Geographic UX exists; tax, duty, compliance, returns, and partner operations do not. |
| Unit economics evidence | 2/10 | Pricing exists, but no cohort-level order economics were found. |
| Moat today | 3/10 | AI generation and storefront features are replicable. |
| Potential moat | 8/10 | Production-feedback data, parametric DFM rules, and a certified factory network could compound. |
| Venture scale | 5/10 DTC / 8/10 platform | The shop can be good; the network/software layer can be large. |
| Execution complexity | 9/10 | Software, manufacturing, logistics, compliance, and marketplace liquidity compound risk. |

## 3. Why the market is real

Etsy's 2025 annual report provides the cleanest public demand signal. Etsy marketplace GMS was $10.46B, with 86.5M active buyers and 5.6M active sellers; custom or made-to-order goods were about 30% of marketplace GMS. That implies roughly **$3.14B of custom/made-to-order GMS on Etsy alone**, before counting Amazon, independent Shopify stores, Zazzle, Shutterfly, local custom shops, B2B signage, and on-demand manufacturing. Etsy also says about half its active buyers purchased only once in 2025, which is a warning about frequency, not just an opportunity. Source: [Etsy 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm).

This is evidence of demand, not Uniqraft's TAM. The initial serviceable market is the subset of personalized decor and light products that:

- can be expressed through constrained, reusable templates;
- have enough gross margin to absorb customization and fulfillment;
- ship safely at favorable dimensional weight;
- can meet electrical and consumer-product requirements;
- are emotionally valuable enough to avoid pure commodity pricing.

### Sensible market sizing for the pitch

Do not lead with a purchased “personalized gifts will be $X billion” report. Investors will discount it. Use three layers:

1. **Demand anchor:** approximately $3.14B of custom/made-to-order GMS on Etsy in 2025.
2. **Initial SAM:** personalized acrylic/wood wall and light decor sold online in the first target regions. This must be estimated from observable marketplace listings, sales ranks, keyword demand, and merchant interviews—not guessed here.
3. **Bottom-up SOM:** orders or merchants the operating system can realistically serve.

Illustrative—not forecast—SOM scenarios:

| Model | Operating assumption | Annual result |
|---|---|---:|
| Focused DTC proof | 10,000 orders × $75 AOV | $750,000 GMV |
| Merchant SaaS | 1,000 merchants × $149/month | $1.79M ARR |
| Fulfillment network | $20M merchant GMV × 8% platform take | $1.6M platform revenue |
| Hybrid | SaaS plus 5% transaction fee plus selected manufacturing margin | Potentially venture-relevant if retention is strong |

The goal of the first year is not to claim the whole personalized-gift market. It is to prove one repeatable “input → approved file → correct physical output” loop.

## 4. The painful investor questions

These are the questions a strong, skeptical investor should ask before being charmed by the demo.

1. Are you a consumer brand, an AI design tool, a factory, a SaaS product, or a two-sided marketplace—and why should I fund five companies at once?
2. What exact customer problem is so painful that people will switch from Etsy sellers, Canva plus a local shop, or an existing product customizer?
3. Where are the paid orders, retention, gross margin, and cohort data? Why are we discussing TAM before proving that strangers pay?
4. What is the single hero product? Why does the roadmap include toys, constructors, decorations, night lights, banners, furniture, metal, and 3D printing?
5. Why is AI necessary? Is it creating customer value or merely making the demo look modern?
6. What percentage of generated outputs are truly production-ready without a designer fixing them?
7. If every custom design still needs human review, is this software leverage or a disguised design agency?
8. Who pays when the preview looks beautiful but the manufactured item looks different?
9. What prevents Customily, Zakeke, Twikit, xTool, Glowforge, a POD supplier, or an Etsy power seller from copying the workflow?
10. What proprietary data will you own after 10,000 orders that a foundation-model provider will not own?
11. Why would a merchant use you instead of Customily connected to Printful, Printify, Gelato, or its existing factory?
12. Why would a consumer discover and trust a new store instead of buying from Etsy or Amazon?
13. What is contribution margin after every variable cost, including failed generations, correction labor, remakes, packaging, payment fees, duties, support, and refunds?
14. How can you economically ship a $40–$100 wooden or acrylic product from Armenia worldwide?
15. After the U.S. ended duty-free de minimis and the EU added a per-item low-value duty, what exactly is your cross-border cost advantage?
16. Who is importer of record, who collects VAT, and will the buyer get an unpleasant customs bill at delivery?
17. Why will customers buy often enough to support paid acquisition when personalized gifts are episodic?
18. What is CAC by channel, and what happens when Etsy/Meta/TikTok auction prices rise?
19. Why do consumers need a credit system for a physical purchase? Does it simplify pricing or hide it?
20. How do you avoid the marketplace cold start when you do not yet have enough buyers or certified factories?
21. How will identical files produce identical results across different lasers, materials, kerf widths, inks, LEDs, finishes, and operator practices?
22. How do you quote instantly when review time and production complexity are uncertain?
23. What happens when a customer uploads Disney, a sports logo, a celebrity, stolen art, or a photo they do not have permission to use?
24. What happens to children's photos, family portraits, and private images after generation? Which subprocessors receive them?
25. Are your night lights compliant electrical products or decorative prototypes? Where are the technical file, traceability, warnings, and test reports?
26. Are your “toys” actually toys? If yes, where are the ASTM F963/CPSIA or EU toy-compliance plans and third-party testing budgets?
27. Who carries product-liability insurance and recall responsibility when a partner factory made the item?
28. Can this business survive seasonality, one-time gifting behavior, and long support conversations for custom orders?
29. What part of the team has scaled manufacturing quality, cross-border logistics, consumer growth, and compliance—not just software?
30. What will the next $1M buy, and which measurable risk will each tranche remove?
31. Which two markets launch first, and why? “Worldwide” is not a market-entry plan.
32. What are the kill criteria? At what remake rate, review time, CAC, or margin do you stop the product line?
33. If OpenAI or another model raises prices, changes policy, or becomes unavailable, does the business stop?
34. What if AI output quality becomes universally cheap and excellent—where does your margin and differentiation move?
35. If DTC demand is weak but factories love the workflow, will you become B2B SaaS? If consumers love the product but merchants do not, will you remain a brand?

## 5. Creative manager answers—strong, honest, and presentation-ready

The right answer is not to pretend every risk is already solved. It is to show sequencing, metrics, and a credible way to learn.

### 1. “Which company are you?”

Today we are intentionally sequencing three layers, not launching them simultaneously. Layer one is a focused DTC lab that proves demand and creates production data. Layer two exposes the proven workflow to merchants as software. Layer three routes validated jobs to certified regional factories. We will not call ourselves a marketplace until external merchants and factories transact repeatedly.

### 2. “What problem is painful enough?”

The painful step is not typing a name on a mug. It is converting uncontrolled customer input into a file that a specific machine, material, and process can manufacture correctly—then quoting, approving, and tracking that one-off job without email ping-pong. Existing tools solve parts of this; we aim to compress the complete loop for selected product families.

### 3. “Where is traction?”

We do not yet claim validated traction from the reviewed materials. The next presentation should distinguish product progress from market proof. Our immediate target is 100 paid, non-founder-network orders from three countries with full contribution-margin reporting. Until then, the correct status is “working product, pre-validation,” not “market-proven.”

### 4. “What is the hero product?”

The launch product is one standardized personalized acrylic LED portrait/name light with limited sizes, bases, colors, and packaging. Other categories stay in the catalog only as experiments or are hidden. A single SKU family gives us enough repetition to improve generation, DFM, QA, shipping, and customer expectations.

### 5. “Why AI?”

AI is useful only where it reduces skilled design time or increases conversion. It can normalize photos, propose line art, fit content to safe zones, generate copy/preview alternatives, and flag risky geometry. Deterministic geometry and templates—not a generative model—must enforce dimensions, cut layers, minimum features, kerf allowances, and hardware constraints.

### 6. “How production-ready is it?”

We will publish a first-pass approval rate, correction minutes, and failure taxonomy by template version. “Production-ready” means it passes machine-readable checks and a human production gate, not merely that an SVG opens. Full automation is earned one constrained template at a time.

### 7. “Is this a design agency?”

At first, partially—and that is acceptable as a learning phase. The operating rule is that review labor must decline by cohort. A template is scalable only when median correction is under 10 minutes and first-pass approval exceeds 85%. Products that fail those gates become premium quoted work or are removed.

### 8. “Who owns preview mismatch?”

Uniqraft owns the customer experience. Each preview must be labeled with the exact variable it represents, calibrated against photographed golden samples, and approved by the buyer. If the manufactured item falls outside a documented tolerance, we remake or refund it and charge the failure to the responsible internal or partner process.

### 9. “What is the moat?”

Not the prompt and not the storefront. The moat must become a versioned manufacturing graph: customer input, template, material lot, machine profile, settings, operator, QA result, remake reason, and customer rating. That data improves DFM checks, quoting, routing, and expected quality. Competitors can copy a feature; they cannot instantly copy years of closed-loop outcomes across factories.

### 10. “What proprietary data?”

We retain only data we are entitled to use. The valuable non-personal dataset is geometry and production telemetry: feature sizes, cut lengths, material behavior, correction actions, pass/fail outcomes, assembly issues, production time, and returns. Customer photos are not training data by default.

### 11. “Why not Customily plus POD?”

For text/photo placement on standard print products, customers should use those platforms; we should not fight them. Our wedge is products where personalization changes manufacturable geometry, layers, joints, engraving paths, parts, assembly, BOM, or machine routing. If we cannot prove a meaningful advantage there, we should integrate rather than compete.

### 12. “Why not Etsy?”

Etsy is a launch channel, not an enemy. It offers concentrated demand and trust. We can validate listings there while the own site handles richer generation and captures consented product data. Over time, merchant software and partner fulfillment reduce dependence on any one acquisition channel.

### 13. “What are the economics?”

Every SKU gets a contribution P&L: net selling price minus discounts, tax borne by us, payment fees, AI, human review, material, consumables, machine time, assembly, QA, packaging, fulfillment, duty subsidy, expected remake/refund, and support. We do not scale a SKU below 35% contribution margin or without a documented route to that level.

### 14. “How do you ship globally from Armenia?”

We do not ship every product globally from one factory. Armenia is the golden factory and R&D cell. Digital files can sell worldwide. Small, flat, high-value products can ship cross-border where landed economics work. Bulky items are region-locked. Proven SKUs move to certified EU and U.S. partners with the same production package and QA standard.

### 15. “What about new duties?”

We model landed cost by lane and show it before payment. The U.S. suspension of duty-free de minimis and the EU's July 2026 €3 per-item low-value duty make regional fulfillment more valuable. The product engine selects origin and supplier using total landed cost, not factory price alone.

### 16. “Who handles VAT and import?”

That is a launch gate, not fine print. For each lane we choose DDP where commercially feasible, appoint the necessary fiscal/customs intermediaries, use IOSS where applicable, classify products by HS code, and state the importer-of-record model. A country is not “enabled” until payment, tax, duty, returns, and compliance are operationally mapped.

### 17. “How do you overcome low frequency?”

Consumer LTV alone may be weak. We build occasion breadth—births, weddings, memorials, pets, homes, holidays—and referrals, but the scalable repeat buyer is the merchant, photographer, event planner, realtor, museum, or gift shop. B2B2C shifts frequency from one consumer's life events to a professional's recurring orders.

### 18. “What about CAC?”

We start with intent-rich channels: Etsy search, creator partnerships, user-generated reveal videos, SEO landing pages by occasion, and B2B outbound to photographers/realtors/event professionals. Paid social is scaled only after creative-level contribution payback is measured. We will report blended and channel CAC separately.

### 19. “Why credits?”

Consumers should see a plain included-design allowance and a final product price. Credits are suitable for repeat creators and merchants, not as a tax on understanding a gift purchase. For DTC, the first valid design attempt should be bundled; extra premium iterations can be priced transparently.

### 20. “How do you solve marketplace cold start?”

We do not open a two-sided marketplace. We control demand and production for one SKU, then add one anchor partner per region. Only after repeated external routing do we onboard additional merchants and factories. Managed network first, marketplace later.

### 21. “How can partners produce consistently?”

Each product has a versioned production package: approved materials/components, machine capability envelope, kerf/calibration coupon, color reference, work instructions, QA checkpoints, packaging spec, sample photos, and acceptable tolerances. Partners qualify with test jobs and ongoing scorecards; routing pauses automatically when metrics fall outside bounds.

### 22. “How do you quote uncertainty?”

Template products receive deterministic pricing from measured cut length, material area, components, machine time, labor standard, and lane cost. Inputs outside the template envelope are not instant-quoted; they enter a paid review/quote path. False certainty is more expensive than a slower honest quote.

### 23. “How do you handle IP abuse?”

We require upload-rights attestation, block or review obvious protected-character/brand requests, maintain notice-and-takedown and repeat-infringer procedures, preserve provenance, and prohibit public resale of customer-provided copyrighted designs without rights. Etsy also requires sellers to hold necessary rights and disclose AI/production partners, so channel policy is part of the control system.

### 24. “What happens to private photos?”

We use explicit purpose consent, publish retention periods, encrypt storage, use signed URLs, minimize subprocessor access, delete source images on schedule, provide deletion/export workflows, and separate customer assets from any model-training corpus. Children's photos receive a stricter policy and are never used in marketing without separate consent.

### 25. “Are lights compliant?”

The launch SKU uses a low-voltage, certified power module from an approved supplier, but the finished assembly still needs a product-specific compliance assessment. Before EU scale we create technical documentation, traceability, declarations and markings where applicable, RoHS/WEEE obligations, instructions, and an EU responsible-person arrangement. Compliance belongs to the SKU, not to a vague company promise.

### 26. “Are they toys?”

Not at launch. We will not use toy, STEM, educational-toy, or child-age positioning until the relevant product has been tested and documented for its intended market. U.S. children's toys require applicable ASTM F963/CPSC certification and, for many provisions, third-party testing. Decor is still subject to general product-safety rules; labeling something “decor” cannot override its reasonably foreseeable use.

### 27. “Who bears liability?”

The contract defines roles, but the brand cannot outsource reputational responsibility. We require partner indemnities, batch/lot traceability, audit rights, corrective-action procedures, recall cooperation, and appropriate product-liability insurance. Uniqraft maintains its own coverage as seller/platform/manufacturer where applicable.

### 28. “Can it survive seasonality and support?”

Capacity, lead times, and cutoff dates are explicit. We build evergreen occasions and B2B recurring work, maintain a seasonal cash plan, and measure support minutes per order. Highly conversational bespoke work gets premium pricing rather than contaminating the economics of standardized personalization.

### 29. “Does the team fit the problem?”

The required founding capabilities are software/AI, manufacturing/quality, and global commerce/growth. Missing capabilities must be filled with accountable operators, not a long advisor slide. Before expansion we need a named owner for compliance and supplier quality.

### 30. “What does $1M buy?”

It should remove risks in tranches: 25% product/DFM and telemetry, 25% demand experiments, 20% partner qualification and QA, 15% compliance/testing/insurance, 10% key hires, and 5% contingency. Release against paid-order, margin, correction-time, and partner-quality gates—not feature count.

### 31. “Which markets first?”

Digital products can be global immediately. Physical launch should be lane-based: one English-speaking demand market and one EU market only after local partner, landed-cost, returns, and compliance readiness. Armenia remains the golden factory and local test bed, not the definition of the market.

### 32. “What are the kill criteria?”

After 100 paid orders, pause or kill a SKU if contribution margin is below 25% with no tested path above 35%, median correction remains above 20 minutes, first-pass approval is below 70%, remake/refund exceeds 8%, or on-time dispatch is below 90%. The company learns by deleting weak complexity.

### 33. “What if the model provider changes?”

Provider-specific generation sits behind a benchmarked abstraction. Templates and deterministic validators remain ours. At least two providers are tested on quality, latency, cost, and policy. Generation jobs are replayable from consented inputs, and provider failure degrades to manual review rather than stopping orders.

### 34. “What if AI becomes free?”

That benefits us if the scarce value is verified manufacturing, routing, QA, compliance, and delivery. We should expect content generation to commoditize. The business must own the last mile from attractive image to correct object.

### 35. “Which pivot wins?”

We predefine the fork. If consumer conversion and margin are strong, remain a focused brand while exposing internal tools slowly. If merchants show stronger recurring pain, package the workflow as SaaS plus fulfillment. If factories adopt DFM/routing but DTC is weak, sell production intake and quoting infrastructure. Evidence chooses the company; the slide deck does not.

## 6. Competitor and substitute map

Competition exists at every layer. The gap is the integration of constrained generative design, product-specific DFM, review, quoting, and regionally consistent fulfillment.

| Layer | Competitors / substitutes | What they already do well | Threat to Uniqraft | Possible wedge or response |
|---|---|---|---|---|
| Demand marketplace | Etsy, Amazon Custom, Zazzle | Trust, search traffic, huge catalogs, reviews | They own consumer discovery and can copy AI entry points | Use as channels; differentiate in the production workflow and merchant tooling |
| Personalized-product software | Customily, Zakeke | Live customization, production-ready files, POD integrations, automated fulfillment | Directly overlaps much of the stated personalization value | Focus where personalization changes geometry/BOM/process, not just artwork placement |
| Enterprise configuration/CPQ | Twikit | Connects product logic, pricing, quotes, BOMs, cutting lists, CAD and orders | Strong B2B manufacturing workflow competitor | Win smaller merchants with faster category templates and managed fulfillment |
| Global POD networks | Printful, Printify, Gelato, Gooten, Merchize | Broad catalog, local production, store integrations, fulfillment | Better coverage and logistics for printed commodities | Integrate for commodity components; avoid competing on T-shirts/mugs |
| Acrylic/personalized fulfillment | PixPOD, ShineOn, Completeful and specialist Etsy suppliers | Automated personalized gifts and established unit costs | Can compress margins and copy hero products | Superior generative transformation, quality proof, and niche B2B channels |
| On-demand manufacturing | Ponoko, SendCutSend, Xometry, Sculpteo and local job shops | Instant quote, DFM, broad processes/materials, reliable production | Could add simpler consumer front ends | Own consumer/merchant intent and product templates; partner where useful |
| AI 3D / asset generation | Meshy, Tripo and many model providers | Fast image/text-to-3D and exports | Generation quality will commoditize | Treat them as interchangeable model suppliers; own manufacturability feedback |
| Maker ecosystems | xTool/Atomm, Glowforge, Cricut ecosystems | Installed hardware, design tools, templates, maker communities, growing AI features | Can close the loop inside their own hardware ecosystem | Machine-agnostic routing and commercial order/QA layer |
| Finished wooden-kit brands | UGEARS, ROKR/Robotime, Wood Trick | Product engineering, instructions, packaging, brand, retail distribution | Set high quality expectations and dominate non-custom kits | Personalized/localized, lower-part-count products; do not fight on complex mechanisms early |
| Wooden decor specialists | Enjoy The Wood, sign/night-light brands, Etsy power sellers | SEO, photography, reviews, standardized production | Price and trust pressure | Better photo-to-product experience plus regional partner delivery |
| Manual workflow | Canva/Illustrator + email + local laser shop | Flexible, familiar, available everywhere | “Good enough” and low software switching cost | Demonstrate measured time-to-approved-order and fewer remakes |

Evidence:

- [Customily](https://www.customily.com/print-on-demand) connects personalization to POD providers and automatically generates production files.
- [Zakeke](https://www.zakeke.com/) offers real-time customization with validated, production-ready output.
- [Twikit](https://twikit.com/) connects configuration, pricing, quoting, BOM/cutting-list/CAD output and manufacturing workflows.
- [Ponoko](https://www.ponoko.com/) offers online DFM, instant quoting and on-demand production across laser cutting and other processes.
- [Xometry](https://investors.xometry.com/news-releases/news-release-details/xometry-reports-record-fourth-quarter-and-strong-full-year-2025/) reported 81,821 active buyers at year-end 2025 and 98% of marketplace revenue from existing accounts, showing the strength of recurring B2B manufacturing demand.
- [Meshy](https://docs.meshy.ai/en/webapp/image-to-3d) turns images into textured 3D models, demonstrating that raw generation is becoming widely available.
- [Glowforge Magic Canvas](https://support.glowforge.com/hc/en-us/articles/12494617488027-embellish-your-designs-with-magic-canvas) already puts generative design inside a laser-maker workflow.

## 7. Risk register

| Risk | Probability | Impact | Early warning | Control / experiment |
|---|---|---|---|---|
| Product sprawl prevents learning | High | Critical | Many categories, few orders per template | Freeze to one hero SKU for the first 100 paid orders |
| AI output is attractive but not manufacturable | High | Critical | High correction time, failed cuts, fragile features | Deterministic geometry rules, validators, golden samples, human gate |
| Human review destroys margin | High | High | Median correction remains above 20 minutes | Instrument edits; template or premium-price repeated exceptions |
| Weak consumer frequency | High | High | Low 90/180-day repeat | Shift repeat economics to merchants and professional referrers |
| CAC exceeds first-order contribution | High | Critical | Payback over three months | Intent channels, referral loops, B2B2C, stop unprofitable paid campaigns |
| Shipping from Armenia is uneconomic | High | Critical | Shipping/duty exceeds 20–25% of AOV | Flat/high-value SKUs, DDP pricing, regional partners, digital files |
| Duties/VAT surprise buyers | High | High | Delivery refusal, support tickets, chargebacks | Landed-cost engine, IOSS/DDP where applicable, explicit terms |
| Regional partner quality varies | High | Critical | Color/dimension variance, remakes by partner | Qualification kits, machine profiles, scorecards, traceability, routing pause |
| Electrical compliance failure | Medium | Critical | Missing technical file/test evidence | Limit components, specialist assessment, approved suppliers, market gate |
| Toy/child-product classification | Medium | Critical | Child-oriented listings without testing | No toy claims until tested; compliance budget and age/intended-use review |
| IP-infringing uploads | High | High | Takedowns, payment/provider warnings | Rights attestation, filters/review, takedown process, repeat-infringer policy |
| Private image/data incident | Medium | Critical | Over-retention or broad internal access | Data minimization, signed access, deletion schedule, processor inventory |
| Preview/physical mismatch | High | High | Low satisfaction despite technically correct product | Calibrated previews, golden photos, tolerances, buyer proof approval |
| Refunds/chargebacks from custom goods | Medium | High | Disputes cluster around expectations/delivery | Clear proof, production evidence, support SLA, remake policy |
| Model-provider dependency | Medium | Medium | Cost/latency/policy changes | Multi-provider benchmark and fallback; deterministic core |
| Credit system hurts conversion | Medium | Medium | Drop-off before generation or confusion tickets | Bundle first design into product; reserve credits for professionals |
| Marketplace cold start | High | High | Too many inactive suppliers/listings | Managed network; one anchor supplier per region; no open marketplace |
| Commodity price competition | High | High | Conversion depends only on discount | Emotional niches, proprietary styles, speed, proof, merchant workflow |
| Cash-flow gap | Medium | High | Supplier/shipping paid before settlements; remakes | Deposits/prepayment, reserves, SKU-level working-capital model |
| Seasonal capacity failure | High | High | Missed gift dates in Q4 | Cutoffs, capped queues, partner overflow, prebuilt components |
| Founder/team scope overload | High | Critical | Software progress but no operations ownership | Named owners for growth, supplier quality, and compliance; staged roadmap |

## 8. Recommended global strategy

### Do not confuse global availability with selling everything everywhere

Use a three-lane catalog:

1. **Global digital:** downloadable, licensed, machine-aware files and merchant software.
2. **Regionally fulfilled physical:** standardized small/medium products made by certified partners near the buyer.
3. **Local/quoted physical:** banners, furniture, large metal, installations, and complex bespoke products limited by geography.

### Market sequence

**Phase 0 — Armenia as golden factory and test market**

- Establish real machine profiles, BOMs, labor standards, failure modes, packaging, and golden samples.
- Validate locally for operational speed, but do not use local demand as the only market evidence.

**Phase 1 — Global demand validation**

- English storefront and Etsy listings for one hero SKU.
- Digital-file sales worldwide.
- Physical shipments only on lanes with known landed cost and delivery SLA.
- Record buyer country and channel; do not advertise “worldwide free shipping.”

**Phase 2 — One EU and one U.S. partner hub**

- Qualify the same SKU and component set.
- Route by landed cost, lead time, capacity, and quality score.
- Compare identical hidden test orders among factories.

**Phase 3 — Merchant product**

- Give photographers, event professionals, realtors, museums, gift shops, and Etsy/Shopify merchants branded templates and wholesale ordering.
- Charge SaaS only after the workflow produces recurring value; before that, use per-order pricing.

**Phase 4 — Managed network**

- Add factories only for demonstrated demand/capability gaps.
- Publish internal capability envelopes, not an uncurated supplier directory.

### Why regional fulfillment is now strategic

Cross-border small-parcel economics changed materially:

- The U.S. suspended duty-free de minimis treatment for goods from all countries effective August 29, 2025. [CBP factsheet](https://www.cbp.gov/sites/default/files/2025-08/factsheet_suspension_of_duty-free_de_minimis_treatment.pdf)
- The EU abolished the €150 customs-duty exemption and began a temporary €3 duty per low-value e-commerce item on July 1, 2026. [European Commission VAT addendum](https://vat-one-stop-shop.ec.europa.eu/document/download/4ba8dc4c-2600-43ee-9010-2101cd05210c_en?filename=VAT+treatment+of+the+EUR+3+customs+duty+and+of+the+announced+Union+handling+fee.pdf)
- EU VAT still requires operational handling, with IOSS designed to simplify relevant imports. [European Commission IOSS overview](https://vat-one-stop-shop.ec.europa.eu/index_en)

These changes do not kill global commerce. They punish lazy landed-cost assumptions and strengthen the case for software that can route work to regional factories.

## 9. Product and business-model recommendation

### Beachhead product

One portrait/name acrylic LED light family:

- one acrylic thickness and approved material;
- one standardized, repairable base;
- two physical sizes;
- warm white and one multicolor hardware option;
- one certified low-voltage power architecture;
- three visual styles with deterministic safe zones;
- optional name/date/message;
- proof approval before production;
- flat, tested packaging.

Avoid arbitrary 3D kits first. Constrained 2D engraving/cutting generates the production data needed for more complex categories later.

### Customer sequence

1. Gift buyer validates emotional value and conversion.
2. Photographer/realtor/event planner validates recurring B2B2C demand.
3. Etsy/Shopify merchant validates software and fulfillment value.
4. Factory partner validates portable production instructions.

### Revenue sequence

| Stage | Revenue | Why now |
|---|---|---|
| DTC proof | Product gross profit; bundled generation | Measures full customer willingness to pay |
| B2B2C | Wholesale product margin; branded ordering portal | Creates repeat orders without consumer repurchase dependence |
| Merchant platform | Per-order fee, then subscription tiers | Monetizes workflow after recurring value is proven |
| Fulfillment network | Transaction/routing fee and optional payment margin | Scales with partner GMV |
| Digital files | File sale and commercial-license tiers | Global, high-margin, no freight; IP enforcement needed |

Do not optimize “credit revenue” as a core story. Investors care about net revenue, margin, retention, and transaction frequency—not an internal token.

## 10. Defensibility roadmap

### Not defensible

- Calling an image model.
- Generating an SVG.
- A credit balance.
- A catalog and checkout.
- Prompt templates.
- Supporting many product categories.

### Potentially defensible

1. **Versioned DFM templates:** geometry, tolerances, safe zones, BOM and process rules for each physical product.
2. **Production outcome graph:** what was requested, generated, corrected, produced, rejected, remade, and loved.
3. **Factory capability graph:** machines, materials, calibration, quality, cost, capacity, geography, certifications, and historical performance.
4. **Closed-loop quoting:** estimates become more accurate from actual machine/labor/remake data.
5. **Trust and compliance layer:** traceable components, proof approval, technical documentation, recalls, and market-specific routing.
6. **Merchant distribution:** embedded workflows and recurring order history create switching cost.

The moat grows only if the system records structured outcomes. A folder of SVGs is not a learning system.

## 11. Compliance, safety, IP, and privacy

### Consumer-product safety

The EU General Product Safety Regulation has applied since December 13, 2024 and explicitly addresses online sales and direct imports; products from outside the EU need an EU responsible person for applicable safety tasks. [European Commission GPSR factsheet](https://commission.europa.eu/document/download/a281b150-19fd-44f9-bef8-c6018f9c4792_en?filename=new_general_product_safety_regulation_-_factsheet.pdf)

For relevant CE-marked products, manufacturers are responsible for conformity assessment, technical documentation, declarations, traceability, and marking. [European Commission CE guidance](https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking_en). Electrical/electronic products may also trigger RoHS and WEEE duties; RoHS covers products with an electrical/electronic component unless excluded. [European Commission RoHS overview](https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en).

### Children's products

In the U.S., children's toys are subject to applicable ASTM F963 requirements and certification; multiple provisions require testing by a CPSC-accepted third-party laboratory. [CPSC toy-safety guidance](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety) and [ASTM F963 chart](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety/ASTM-F-963-Chart).

The safest initial choice is adult/general decor with careful marketing and foreseeable-use review—not a legal fiction that a child-oriented night light is automatically “not for children.” Obtain market-specific advice before launch.

### IP and channel policy

Etsy permits seller-designed goods produced by computerized tools and seller-prompted AI creations, but requires originality/rights, AI disclosure, and disclosure of production partners and shipping origin. [Etsy Creativity Standards](https://www.etsy.com/legal/creativity) and [Seller Policy](https://www.etsy.com/legal/sellers/).

Required controls include:

- rights attestation at upload;
- documented prohibited-content policy;
- human review for likely brand/character/celebrity infringement;
- notice-and-takedown and repeat-infringer processes;
- provenance and consent logs;
- separate terms for personal-use and commercial digital-file licenses.

### Privacy

Uploaded family and child photos are high-trust assets even where they are not legally “sensitive data.” The product should have:

- a clear purpose and lawful basis;
- subprocessor disclosure;
- source-image and generated-asset retention periods;
- user deletion/export;
- access controls and audit logs;
- separate marketing consent;
- no training use by default;
- incident response and regional privacy review.

## 12. Metrics investors will expect

### Demand

- Paid conversion by channel and country.
- AOV and discount rate.
- Generation-start → proof-approval → checkout funnel.
- Cancellation before production.
- Referral and organic share.
- Consumer repeat plus merchant repeat.

### Generation and review

- Valid output rate.
- First-pass approval rate.
- Regeneration rate and attempts per paid order.
- Median and p90 human correction minutes.
- Failure taxonomy by template/model/version.
- AI and storage cost per approved order.

### Production and fulfillment

- Actual versus quoted machine/labor time.
- Scrap, remake, and refund rates.
- Dimensional/color/assembly defect rate.
- On-time dispatch and on-time delivery.
- Damage and lost-parcel rate.
- Partner score by SKU and version.

### Economics

- Net revenue and GMV separately.
- Gross margin and contribution margin per SKU, market, channel, and factory.
- CAC, first-order contribution, and payback.
- Support minutes and cost per order.
- Duty/tax/shipping subsidy.
- Working-capital days and refund reserve.
- SaaS MRR/ARR, gross retention and net revenue retention when applicable.

### North-star metric

Use **monthly approved products delivered on time with positive contribution margin**. It forces software quality, manufacturing correctness, customer value, and economics into one number.

## 13. 90-day validation plan

### Days 1–14: focus and instrumentation

- Freeze one hero SKU and two physical sizes.
- Create the complete SKU contribution model.
- Produce at least 20 golden samples from varied photo inputs.
- Define production tolerances and preview disclaimers.
- Instrument every generation, correction action, production job, QA result, and support event.
- Remove or hide unrelated categories from the primary investor/customer story.

### Days 15–35: global demand test

- Launch English product pages and 3–5 Etsy listings by occasion.
- Test real prices, not waitlists.
- Run small creator and search campaigns with country-specific landed cost.
- Interview 20 failed converters and every refund/cancellation.
- Target 30 paid orders from outside the founder's immediate network.

### Days 36–65: repeatability and channel test

- Reach 100 cumulative paid orders across at least three countries.
- Publish internal cohort economics weekly.
- Sign 10 pilot professionals: photographers, realtors, event planners, museums/gift shops, or Etsy merchants.
- Test co-branded/wholesale ordering and measure repeat intent.
- Kill styles or input types that create repeated correction and remake costs.

### Days 66–90: portable manufacturing test

- Qualify one external regional factory on the hero SKU.
- Send blind duplicate jobs to the golden factory and partner.
- Compare dimensions, appearance, cost, lead time, packaging, and customer rating.
- Complete launch-market compliance gap assessment and insurance quotes.
- Decide with evidence: focused brand, merchant SaaS, fulfillment network, or no-go.

### 90-day go/no-go gates

| Metric | Go | Caution | Stop/rework |
|---|---:|---:|---:|
| Paid orders | ≥100 | 50–99 | <50 despite tested positioning/channels |
| Contribution margin | ≥35% | 25–34% | <25% |
| First-pass approval | ≥85% | 70–84% | <70% |
| Median correction | <10 min | 10–20 min | >20 min |
| Remake/refund | <5% | 5–8% | >8% |
| On-time dispatch | ≥95% | 90–94% | <90% |
| External partner pass | ≥95% spec-conforming | 90–94% | <90% |
| Professional pilots repeating | ≥5 of 10 | 2–4 | <2 |

## 14. Comprehensive investor presentation question bank

No finite list can contain literally every question, but the following 160-question bank covers the major lines of diligence. Rehearse short answers and keep the supporting data in appendix slides.

### A. Vision and company definition

1. What does Uniqraft become in ten years?
2. What is the one-sentence company description without using “AI-powered”?
3. Are you primarily a software-margin or manufacturing-margin company?
4. Which part of the value chain must you own?
5. Which parts will you deliberately partner or outsource?
6. Why is now the right moment for this company?
7. What changed technically, economically, or behaviorally in the last two years?
8. What will you never build even if customers request it?
9. What is the narrow wedge, and what is the credible expansion sequence?
10. What milestone makes “marketplace” an accurate description rather than an aspiration?

### B. Problem and customer

11. Who is the primary user, buyer, payer, and beneficiary?
12. What job is the customer hiring Uniqraft to do?
13. How frequently does that job occur?
14. How is the problem solved today?
15. What is the quantified time, cost, or error burden of the current workflow?
16. Is the pain stronger for consumers, merchants, designers, or factories?
17. Which segment showed the highest willingness to pay?
18. Which segment looked attractive but rejected the product?
19. What customer behavior proves this is a need rather than novelty?
20. What is the strongest verbatim objection from a lost customer?

### C. Product and experience

21. Show the full journey from photo/prompt to delivered object.
22. Where does the customer experience the “magic moment”?
23. What input types work reliably today?
24. What inputs are explicitly rejected?
25. How many choices are constrained, and why?
26. What does the buyer approve before production?
27. How do you communicate preview uncertainty?
28. What happens after a failed generation?
29. What happens when the buyer dislikes valid outputs?
30. Why are credits better than transparent per-product pricing?

### D. Traction and customer evidence

31. How many paid orders have been completed?
32. How many came from people with no personal connection to the team?
33. How many countries have paid customers?
34. What are GMV, net revenue, refunds, and recognized revenue?
35. What is conversion by acquisition channel?
36. What is repeat purchase at 30, 90, 180, and 365 days?
37. What percentage of orders arrive organically or by referral?
38. How many customers approved the first output?
39. What is NPS or the more useful product-specific satisfaction measure?
40. What changed after the last 25 customer interviews?

### E. Market and segmentation

41. What is TAM, SAM, and SOM, and how was each calculated?
42. Why is personalized gift GMS relevant to your exact product?
43. How large is the hero-SKU category specifically?
44. Which countries have the strongest observed demand?
45. How does demand differ by occasion, culture, and season?
46. What portion of the market is online versus offline?
47. What portion can be served with standardized templates?
48. What portion requires human bespoke design?
49. Which adjacent category comes next, and what shared capability unlocks it?
50. What evidence would prove the market is too small?

### F. Business model and pricing

51. Who pays Uniqraft, for what, and when?
52. What are current and planned revenue streams?
53. What is the price architecture for DTC, wholesale, SaaS, and network orders?
54. Why will merchants accept the platform fee or take rate?
55. What is the effective take rate after discounts and incentives?
56. Is generation bundled, metered, subscribed, or charged per successful output?
57. How do refunds affect revenue recognition?
58. What is the role of digital-file licensing?
59. Could a high-volume merchant bypass the network after receiving files?
60. How does pricing change as automation improves?

### G. Unit economics and finance

61. What is gross margin by SKU, country, channel, and factory?
62. What is contribution margin after all variable costs?
63. What costs are currently hidden in founder labor?
64. How many review minutes are included in COGS?
65. What is expected remake/refund cost per order?
66. What is shipping and duty as a percentage of AOV?
67. What is payment processing and chargeback cost by market?
68. What is CAC and payback by channel?
69. How much working capital is required at 10× order volume?
70. What happens to margin at 100, 1,000, and 10,000 monthly orders?

### H. AI and technical architecture

71. Which steps use generative AI, classical vision, deterministic geometry, and human review?
72. Which model providers are used, and why?
73. What is AI cost and latency per successful paid order?
74. What benchmark determines whether a provider is acceptable?
75. How do you prevent hallucinated or unsafe geometry?
76. What is the output schema for manufacturing artifacts?
77. How are model, prompt, template, and validator versions recorded?
78. Can a job be reproduced exactly for audit or remake?
79. How does the system fail safely when a provider is down?
80. What technical work would be hardest for a well-funded competitor to reproduce?

### I. Manufacturing and quality

81. Which exact machines, materials, and thicknesses are production-qualified?
82. What is the approved capability envelope for the hero SKU?
83. What is the first-pass production yield?
84. What are the top five defect and remake causes?
85. How are kerf, color, power, speed, focus, and material-lot variation controlled?
86. What QA evidence is stored for each order?
87. How are golden samples created and updated?
88. What is the capacity and bottleneck of the current workshop?
89. How quickly can a partner factory be qualified?
90. Who has authority to stop production or suspend a partner?

### J. Supply chain and fulfillment

91. Which components have single-source risk?
92. What happens if acrylic, LEDs, power modules, plywood, or packaging become unavailable?
93. What inventory is held, and who owns it?
94. How are component substitutions approved?
95. Which products ship flat, assembled, or as kits?
96. What are damage and lost-parcel rates?
97. What is promised versus actual delivery time by lane?
98. How are holiday cutoff dates and capacity limits managed?
99. Where are returns received and inspected?
100. Can products be repaired, or must they be remade?

### K. Go-to-market and sales

101. What is the first repeatable acquisition channel?
102. Why will Etsy listings lead to a defensible company rather than an Etsy shop?
103. What is the own-site conversion rate versus marketplace conversion?
104. Which content format drives the highest qualified traffic?
105. What is the SEO strategy by product, occasion, and geography?
106. Which professional channel—photographers, realtors, events, museums, gift shops—has the strongest economics?
107. What is the merchant sales cycle?
108. What integration is necessary to close a merchant?
109. What is the reseller/wholesale discount structure?
110. How do you avoid channel conflict between DTC, merchants, and marketplaces?

### L. Competition and moat

111. Who is the closest direct competitor today?
112. Which competitor wins on product experience, price, logistics, software, and trust?
113. Why will Customily or Zakeke not move deeper into manufacturing geometry?
114. Why will Xometry or Ponoko not add a consumer personalization layer?
115. Why will xTool/Glowforge not keep the workflow inside their ecosystem?
116. What happens if Etsy or Amazon launches prompt-to-custom-product ordering?
117. What customer or supplier switching costs exist?
118. What network effect exists, and when does it begin?
119. What data advantage improves with every order?
120. What is proprietary beyond contracts and execution speed?

### M. Global markets, payments, tax, and customs

121. Which countries are truly open for checkout today?
122. Which two physical markets launch first, and what evidence selected them?
123. Which products are global, region-only, or local-only?
124. Which payment methods and currencies convert best in each market?
125. Can Ameriabank vPOS accept target-market cards reliably, and what are decline/settlement economics?
126. Who is merchant of record and importer of record?
127. How are VAT, sales tax, customs duty, brokerage, and HS classification handled?
128. Are prices DDP or DAP, and is that clear before checkout?
129. What entity, bank, and fiscal structure supports EU and U.S. operations?
130. How quickly can a country be disabled if compliance or delivery fails?

### N. Safety, regulatory, legal, and insurance

131. Which regulations apply to each SKU in each market?
132. Is the night light electrical equipment, a luminaire, a toy, or general decor under applicable rules?
133. Where are conformity assessments, declarations, technical files, test reports, and traceability records?
134. Who is the EU responsible person?
135. What RoHS, WEEE, packaging, and extended-producer-responsibility duties apply?
136. Are any products marketed to children, and what testing supports that positioning?
137. What product-liability, cyber, cargo, and general insurance is in force?
138. What is the recall and Safety Gate/CPSC reporting process?
139. What warranties and consumer cancellation exceptions apply to personalized goods?
140. Which legal opinions or specialist assessments remain outstanding?

### O. IP, content, privacy, and security

141. Who owns customer inputs, generated previews, manufacturing files, and template improvements?
142. What rights does Uniqraft receive to process uploaded photos?
143. How are trademark, copyright, publicity-right, and prohibited-content requests handled?
144. What is the notice-and-takedown and repeat-infringer procedure?
145. Must Etsy listings disclose AI and production partners?
146. Are customer photos used to train any model?
147. Which subprocessors receive photos or prompts?
148. What are retention and deletion periods for source and generated assets?
149. How are minors' photos and sensitive family images handled?
150. What are the most serious security threats and tested incident-response steps?

### P. Team, governance, fundraising, and outcomes

151. Why is this team uniquely qualified to win?
152. Who owns software, manufacturing quality, growth, finance, and compliance?
153. Which critical hire must be made next?
154. What have the founders learned that changed their original thesis?
155. How much is being raised, at what runway, and for which milestones?
156. What assumptions are embedded in the financial plan?
157. What is the board and reporting cadence?
158. What are the pre-agreed kill, pause, and pivot criteria?
159. Who could acquire this company, and why would acquisition be preferable to building internally?
160. What does success look like if the company becomes a profitable specialist rather than a venture-scale platform?

## 15. Recommended investor-deck storyline

1. **Problem:** custom physical products still require manual translation between buyer intent and production reality.
2. **Demo:** one constrained photo-to-approved-product flow, including the actual production file and delivered sample.
3. **Proof:** paid orders, countries, approval rate, correction time, margin, remake rate, and delivery performance.
4. **Wedge:** one standardized personalized-light/decor family.
5. **Why now:** capable generative models plus digitally controlled manufacturing, while production orchestration remains fragmented.
6. **Market:** Etsy custom/made-to-order demand anchor plus bottom-up hero-SKU and merchant SAM.
7. **Business model:** DTC learning → professional repeat channel → merchant software → managed regional fulfillment.
8. **Moat:** production outcome graph, DFM templates, factory capability/quality graph, and compliance/routing layer.
9. **Competition:** show respect for Customily, Zakeke, Twikit, Etsy, POD networks, and on-demand manufacturers; make the boundary clear.
10. **Global design:** Armenia golden factory, global digital products, regional physical partners, landed-cost routing.
11. **Roadmap:** milestones that remove demand, margin, automation, quality, and partner-portability risk.
12. **Ask:** capital allocated to explicit de-risking gates, not a catalog explosion.

## 16. Presentation traps to avoid

- Do not call the current product “fully automated manufacturing.”
- Do not say “no competitors.” It signals weak research.
- Do not use the whole personalized-gifts market as SAM.
- Do not count generated images, sign-ups, or credits purchased as delivered-product traction.
- Do not mix GMV, revenue, and gross profit.
- Do not present product gross margin while excluding review, remakes, shipping support, and duties.
- Do not claim worldwide coverage because every country appears in a selector.
- Do not hide cross-border duties behind “shipping calculated at checkout.”
- Do not position toys or child-oriented lights without a compliance answer.
- Do not call OpenAI access a moat.
- Do not present twenty product categories; investors will infer lack of focus.
- Do not promise an open marketplace before proving managed fulfillment.
- Do not answer hard questions with future feature lists; answer with evidence, thresholds, and owners.

## 17. Bottom line

The idea has a credible global opportunity, but the global company is not “an Armenian marketplace that ships everything everywhere.” It is a **design-to-production system with a focused consumer wedge, a golden factory for learning, and regional production for scale**.

The strongest immediate move is ruthless narrowing: one product family, 100 global paid orders, complete contribution economics, measured correction time, and one external partner producing the same item reliably. If those results are strong, Uniqraft can graduate from a clever custom-product shop into a merchant and factory operating layer. If they are weak, the same experiment will reveal whether the better business is a premium local brand, digital-file product, factory intake tool, or no-go.

## 18. Sources consulted

### Market and company evidence

- [Etsy 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm)
- [Xometry full-year 2025 results](https://investors.xometry.com/news-releases/news-release-details/xometry-reports-record-fourth-quarter-and-strong-full-year-2025/)
- [Etsy Creativity Standards](https://www.etsy.com/legal/creativity)
- [Etsy Seller Policy](https://www.etsy.com/legal/sellers/)

### Competitors and substitutes

- [Customily personalized POD and production-file workflow](https://www.customily.com/print-on-demand)
- [Zakeke product customization platform](https://www.zakeke.com/)
- [Twikit configuration-to-production platform](https://twikit.com/)
- [Ponoko on-demand laser cutting and manufacturing](https://www.ponoko.com/)
- [SendCutSend online laser cutting](https://sendcutsend.com/home-v/)
- [Meshy image-to-3D documentation](https://docs.meshy.ai/en/webapp/image-to-3d)
- [Glowforge Magic Canvas](https://support.glowforge.com/hc/en-us/articles/12494617488027-embellish-your-designs-with-magic-canvas)

### Global trade and tax

- [U.S. CBP suspension of duty-free de minimis](https://www.cbp.gov/sites/default/files/2025-08/factsheet_suspension_of_duty-free_de_minimis_treatment.pdf)
- [White House order suspending de minimis for all countries](https://www.whitehouse.gov/presidential-actions/2025/07/suspending-duty-free-de-minimis-treatment-for-all-countries/)
- [European Commission: goods bought online](https://taxation-customs.ec.europa.eu/customs/eu-customs-union-facts-and-figures/goods-bought-online_en)
- [European Commission IOSS overview](https://vat-one-stop-shop.ec.europa.eu/index_en)
- [European Commission VAT treatment of the €3 low-value customs duty](https://vat-one-stop-shop.ec.europa.eu/document/download/4ba8dc4c-2600-43ee-9010-2101cd05210c_en?filename=VAT+treatment+of+the+EUR+3+customs+duty+and+of+the+announced+Union+handling+fee.pdf)

### Product safety and compliance

- [European Commission GPSR factsheet](https://commission.europa.eu/document/download/a281b150-19fd-44f9-bef8-c6018f9c4792_en?filename=new_general_product_safety_regulation_-_factsheet.pdf)
- [European Commission product compliance guidance](https://europa.eu/youreurope/business/product-requirements/compliance/index_en.htm)
- [European Commission CE marking](https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking_en)
- [European Commission RoHS](https://environment.ec.europa.eu/topics/waste-and-recycling/rohs-directive_en)
- [CPSC toy-safety business guidance](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety)
- [CPSC ASTM F963 requirements chart](https://www.cpsc.gov/Business--Manufacturing/Business-Education/Toy-Safety/ASTM-F-963-Chart)

### Internal product evidence

- `README.md`
- `docs/requirements/mvp-marketplace-requirements.md`
- `docs/requirements/mvp-marketplace-decisions.md`
- `docs/requirements/geographic-commerce-requirements.md`
- `docs/investigations/wood-constructor-business-model.md`
- `wood-laser-cut-product-investigation.md`
- `docs/manufacturing/product-opportunities.md`
- `lib/marketplace-constants.ts`
- `lib/market.ts`
- `lib/shipping.ts`
- `lib/currency.ts`
- `supabase/migrations/20260704091247_geographic_catalog_currency_shipping.sql`
