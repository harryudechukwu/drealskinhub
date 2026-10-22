# DrealSkinhub

A custom coded skincare storefront and protected store admin, built with HTML, CSS, JavaScript, and a Node.js API. The selected deployment stack is **Netlify + Turso + Sender**. Local development uses SQLite and works without cloud credentials.

## Open the local website

Requires Node.js 24 or later. Dependencies have already been installed in this workspace.

```powershell
npm.cmd start
```

- Storefront: <http://127.0.0.1:4173>
- Administration: <http://127.0.0.1:4173/admin>

On your first admin visit, create your own account. There is no default password. Use at least 12 characters. Local records are stored in `data/store.sqlite`; uploaded files are in `data/uploads/`. Keep this directory private and back it up. Use `npm.cmd run dev` for server restart on edits; refresh the browser after frontend changes.

On a fresh checkout, install dependencies with `npm ci --omit=optional --ignore-scripts`. Optional native database binaries are unnecessary: local development uses Node's SQLite module, and the hosted API uses Turso's HTTP driver.

## What is implemented

- Responsive storefront with the supplied logo and brand colours, real skincare photography, readable typography, subtle animation, and reduced-motion support.
- Search, category/brand/concern/price/availability filters, sorting, product pages, stock labels, related products, and new/featured collections.
- Persistent bag, account and guest checkout previews, server-calculated prices, delivery areas, discounts, and wishlist syncing for signed-in customers.
- Atomic inventory updates; duplicate submission protection; cancellation restores stock once.
- Customer registration, login, password reset, profile editing, order history, and guest order tracking.
- Consultation information and pricing, appointment availability in Lagos time, collision protection, customer notes, and admin booking management.
- Consent-based guide/newsletter signups, deduplicated subscribers, source tracking, tags, unsubscribe, Sender integration, and local email outbox.
- Editable pages, articles, FAQs, homepage sections, announcement, hero text/image, delivery rates, guide PDF, support details, and social links.
- Admin product photos, prices, sizes, ingredients, usage, precautions, stock, visibility, featured status, discounts, order fulfilment/tracking, contact messages, activity log, and data exports.

## Important current state

This is a **working preview, not a live commerce launch**. Products, brands, artwork, prices, delivery fees, and consultation prices are labelled examples. No testimonials or claimed customer results were invented.

**Payments are deliberately not connected.** Checkout and consultations create preview records and take no money. There is no switch that silently turns a preview order into a paid order. A payment provider, server-side verification/webhooks, reservation expiry, refunds/cancellations, and live payment tests must be completed before sales launch.

Sender and Turso adapters are coded and tested with local doubles; real credentials have not been supplied, and live provider calls have not been verified. No cloud resources were created and nothing was deployed. The free guide file, approved business policies, actual contact details, and verified catalogue remain owner-provided launch content. The site bundles DM Sans under its open font licence.

## Deploy to Netlify with Turso

1. Create a Turso **libSQL-compatible database** and a database auth token. This project uses `@libsql/client/web`; choose the libSQL engine supported by that driver. Keep the token private.
2. Put this project in your own Git repository and connect it to Netlify. Use the repository root as the base directory. `netlify.toml` sets the build command to `npm run check`, publishes `public/`, and bundles `netlify/functions/`.
3. Set these **server environment variables** in Netlify, with Functions scope where available:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | Your Turso libSQL database URL |
   | `TURSO_AUTH_TOKEN` | Private database auth token |
   | `ADMIN_SETUP_TOKEN` | A private, randomly generated token of at least 32 characters |
   | `SITE_URL` | Your site's full HTTPS URL, without a trailing slash |
   | `EMAIL_ENABLED` | `false` until Sender is configured |

4. Deploy the preview. The API creates its tables and illustrative starting content once. It never re-seeds an existing store.
5. Open `/admin`, enter your setup token, and create your administrator account. Remove `ADMIN_SETUP_TOKEN` from Netlify after successful setup. The database enforces a single initial administrator, and the setup endpoint closes once one exists.
6. Upload product media and the guide from the admin. On Netlify, uploaded files persist in **Netlify Blobs**; locally they stay on disk. Turso holds the structured store data. Files must be JPG, PNG, WebP, or PDF, at most 3 MB each.

Netlify's default Node.js 24 runtime is supported. If your existing Netlify site is pinned to an older runtime, set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` through Netlify's environment settings. Do not put this variable in `netlify.toml`.

**Deploy Preview isolation:** use a separate Turso database/token for Netlify Deploy Previews. Production and preview uploads use separate blob store names. Do not point test deployments at real customer data. The first local SQLite catalogue is not automatically transferred to Turso; edit the hosted catalogue after setup or plan a deliberate data migration.

## Connect Sender

1. Create your Sender account and verify your sending domain/address as instructed by Sender.
2. Create groups for **Skincare Guide** and **Newsletter**, and copy their IDs.
3. In Sender, create a welcome automation triggered when someone joins the guide group. Add the publicly reachable HTTPS link to your uploaded guide PDF to its email. Create a separate newsletter welcome automation if wanted. Keep Sender's unsubscribe link enabled.
4. Set these Netlify environment variables:

   ```text
   SENDER_API_KEY=your-private-key
   SENDER_GUIDE_GROUP_ID=your-guide-group-id
   SENDER_NEWSLETTER_GROUP_ID=your-newsletter-group-id
   SENDER_FROM_EMAIL=your-verified-sender-address
   SENDER_FROM_NAME=DrealSkinhub
   EMAIL_ENABLED=true
   ```

5. Redeploy so Functions receive the new environment. Test both signup forms with an address you control. Check the subscriber group and actual welcome email/guide. A successful API call does not guarantee inbox delivery.
6. In Admin → Subscribers, **Sync pending to Sender** processes up to 10 saved subscribers at a time. The table shows sync status and actionable errors. Manage campaigns, segmentation, reporting, and monthly newsletters in Sender. CSV exports are also available.

New signups create or update one local subscriber record per normalised email and record each signup source. Group membership triggers the Sender welcome automation. The code does not override Sender suppression flags. If a subscriber previously unsubscribed in Sender, use Sender's own compliant resubscription workflow; adding group membership does not reactivate them.

Unsubscribing through the website or admin updates Sender when enabled. Sender handles links in its own campaigns; changes made directly in Sender remain authoritative there. The local list does **not** currently ingest Sender webhook events, so export/send campaigns from Sender, not from a stale local status. Webhook availability may depend on your Sender plan.

Password resets and transactional notifications use Sender's transactional API when a verified sender is configured. Otherwise they remain in the preview outbox at `/admin#outbox`. Reset links are single-use, expire in 30 minutes, invalidate existing sessions, and are redacted from delivered outbox entries. Outbox entries are claimed before sending to reduce duplicate delivery; uncertain delivery is flagged for manual review instead of automatic resend. Queued messages are processed after API writes, up to two per request. A production store should add scheduled outbox processing and operational monitoring before launch.

For local provider testing, copy `.env.example` to `.env` and configure it privately. `npm start` reads `.env` automatically. Keep `EMAIL_ENABLED=false` for ordinary sample-data testing.

## Admin notes

- **Products:** add/edit products, images, stock, promotions, concerns, and descriptions. Archiving hides a product while retaining its information. Re-enable “Visible in the shop” to restore it.
- **Settings → Collections:** change categories, concerns, and brands. If you rename a collection, update products using that collection too.
- **Orders:** inspect delivery details, adjust fulfilment, and enter tracking information. A cancelled order cannot be reopened. Refunds are not simulated.
- **Consultations:** manage bookings; use “Manage availability” to add dated slots in Lagos time. Slots must be at least one consultation duration apart. No fake availability is seeded.
- **Website content:** publish pages, articles, FAQs, and verified reviews. Review sections stay hidden until genuine reviews are published.
- **Settings → Homepage:** update the hero, announcement, section visibility, and about introduction. The original supplied logo is retained.
- **Photography:** ten compressed Pexels photographs are bundled in `public/assets/photos/` (about 610 KB total), with photographer and licence links in `CREDITS.md`. The hero and consultation photos can be replaced in Settings. Product uploads override representative stock photos on labelled sample products. Category and journal imagery uses the bundled collection. No external image host is contacted by the browser.
- **Visual system:** `public/design.css` defines the shared text scale, controls, layout spacing, image treatment, and admin refinements. Body text is 16–18 px, inputs are 16 px, normal controls are 15–16 px, and supporting captions are 12–14 px. Small decorative text in the logo and fallback packaging is separate from interface text.
- **Settings → Skincare guide:** upload the owner-approved PDF. Update the link in Sender's guide automation if replacing it.
- **Subscribers:** view consent/source, tag, unsubscribe, sync pending records, and export CSV.
- **Data:** the JSON export includes store records but excludes passwords/session/reset tokens and uploaded file bytes. It is a portable export, not a full database restore. Back up the database and media separately.

## Verification

```powershell
npm.cmd run check
npm.cmd test
```

Tests cover authentication/authorisation, cross-origin write rejection, pricing, inventory, duplicate submissions, stock restoration, discount limits, customer data isolation, appointment collisions, signup deduplication/consent, CRUD, upload validation, password resets, Turso transaction rollback/batching, Sender request construction/error handling, and Netlify setup security.

Visual checks were completed in installed Chrome at **320 × 740, 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900, and 1900 × 900**. Screenshots were reviewed for the storefront, product suggestions, wishlist, contact page, consultation page, cart, checkout, and admin. Automated checks cover page overflow, broken images, browser errors, mobile navigation, section alignment, styled form controls, preview checkout, and saving an admin product edit through to the storefront. The browser used an isolated sample database and blocked external page requests.

Run `npm.cmd run test:visual` to repeat this check with an installed Chrome/Edge (or set `VISUAL_BROWSER` to its executable). No browser download is needed. Results and screenshots are written to `.cache/visual/`. These are Chromium viewport checks; physical iOS/Safari and Android device testing remains a separate pre-launch check.

## Code layout

```text
public/                  Storefront, admin interface, styles, supplied brand assets
server.mjs               Shared API and local HTTP server
lib/database.mjs         Local SQLite / hosted Turso adapter, transaction batching
lib/seed.mjs             Clearly labelled starting content
lib/sender.mjs           Sender API integration
lib/media.mjs            Local / Netlify Blobs upload storage
netlify/functions/api.mjs Netlify Request/Response adapter
netlify.toml             Hosting routes, security headers, build configuration
test/                    Offline automated tests
data/                    Local runtime data (ignored by Git)
```

Reference documentation: [Netlify Functions](https://docs.netlify.com/build/functions/get-started/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Turso JavaScript SDK](https://docs.turso.tech/sdk/ts/reference), [Sender subscribers](https://api.sender.net/subscribers/add-subscriber/), [Sender transactional email](https://api.sender.net/transactional-campaigns/send-transactional/).
