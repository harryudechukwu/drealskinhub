# DrealSkinhub

A custom coded skincare storefront and protected store admin, built with HTML, CSS, JavaScript, and a Node.js API. The deployment stack is **Netlify + Turso + Cloudinary**, with **web push for owner order alerts**. Customer order messages are prepared in admin for manual sending. Local development uses SQLite and works without cloud credentials.

## Open the local website

Requires Node.js 24 or later. Dependencies have already been installed in this workspace.

```powershell
npm.cmd start
```

- Storefront: <http://127.0.0.1:4173>
- Administration: <http://127.0.0.1:4173/admin>

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to use environment-managed admin sign-in locally. Without them, the one-time local setup form remains available. There is no default password. Local records are stored in `data/store.sqlite`; uploads use Cloudinary when configured, otherwise local files. Keep the data directory private and back it up. Use `npm.cmd run dev` for server restart on edits; refresh the browser after frontend changes.

On a fresh checkout, install dependencies with `npm ci --omit=optional --ignore-scripts`. Optional native database binaries are unnecessary: local development uses Node's SQLite module, and the hosted API uses Turso's HTTP driver.

## What is implemented

- Responsive storefront with the supplied logo and brand colours, real skincare photography, readable typography, subtle animation, and reduced-motion support.
- Search, category/brand/concern/price/availability filters, sorting, product pages, stock labels, related products, and new/featured collections.
- Persistent bag, account and guest checkout, server-calculated prices, delivery areas, discounts, and wishlist syncing for signed-in customers.
- Atomic inventory updates; duplicate submission protection; cancellation restores stock once.
- Customer registration, login, password reset, profile editing, order history, and guest order tracking.
- Consultation information and pricing, appointment availability in Lagos time, collision protection, customer notes, and admin booking management.
- Consent-based guide/newsletter signups, deduplicated subscribers, source tracking, tags, unsubscribe, and a local email outbox. Marketing automation remains unconnected.
- Editable pages, articles, FAQs, homepage sections, announcement, hero text/image, delivery rates, guide PDF, support details, and social links.
- Admin product photos, prices, sizes, ingredients, usage, precautions, stock, visibility, featured status, discounts, order fulfilment/tracking, contact messages, activity log, and data exports.

## Important current state

This is a **working site with sample catalogue content**. Products, brands, artwork, prices, delivery fees, and consultation prices are labelled examples. Replace these with verified business details before taking real orders. No testimonials or claimed customer results were invented.

**Store checkout uses manual bank transfer.** Customers place an order, confirm the email address or WhatsApp number they entered at checkout, then see server-configured bank details on a private payment page and upload a JPG/PNG/WebP receipt image. The API does not return the account number or accept a payment proof until that contact matches the order. Checkout fields and verified payment contact survive a refresh in the same browser tab. The order remains unconfirmed until an administrator independently checks the bank account, enters its statement reference, and clicks **Confirm payment & generate receipt**. A submitted image alone never marks an order paid. Registered admin devices receive push alerts on order creation and receipt submission. Admin prepares a customer message from each order, reviews it, and sends it manually by email or WhatsApp. The prepared confirmation includes a private receipt link only after bank verification. The 24-hour review window is an operational target, not an automatic payment guarantee. Consultations remain preview bookings and collect no fee.

Checkout stays closed on Netlify until valid bank environment variables, Cloudinary image storage, push keys, and at least one registered admin push device are configured. Gmail is not needed for checkout. Bank details cannot be edited in site settings or supplied in checkout requests. Uploaded receipt images are stored as authenticated assets and are available only through administrator access. PDF receipts are generated only after manual verification. Protect the Netlify account and environment variables with strong authentication, check the account number on the deployed site before sharing it, and verify a real bank credit before issuing any receipt. Push can be delayed or blocked by device settings, so review the admin order list regularly.

Gmail, push, Turso, and Cloudinary adapters are coded and tested with local doubles; real credentials have not been supplied, and live provider calls have not been verified. No cloud resources were created and nothing was deployed. The free guide file, approved business policies, actual contact details, and verified catalogue remain owner-provided launch content. The site bundles DM Sans under its open font licence.

## Deploy to Netlify with Turso

1. Create a Turso **libSQL-compatible database** and a database auth token. This project uses `@libsql/client/web`; choose the libSQL engine supported by that driver. Keep the token private.
2. Put this project in your own Git repository and connect it to Netlify. Use the repository root as the base directory. `netlify.toml` sets the build command to `npm run check`, publishes `public/`, and bundles `netlify/functions/`.
3. Set these **server environment variables** in Netlify, with Functions scope where available:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | Your Turso libSQL database URL |
   | `TURSO_AUTH_TOKEN` | Private database auth token |
   | `ADMIN_EMAIL` | Administrator sign-in email |
   | `ADMIN_PASSWORD` | Administrator sign-in password, at least 12 characters |
   | `ADMIN_NAME` | Optional administrator display name |
   | `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
   | `CLOUDINARY_API_KEY` | Cloudinary API key |
   | `CLOUDINARY_API_SECRET` | Cloudinary API secret; server-side only |
   | `SITE_URL` | Your site's full HTTPS URL, without a trailing slash |
   | `BANK_NAME` | Exact bank name shown to customers |
   | `BANK_ACCOUNT_NAME` | Exact beneficiary name shown to customers |
   | `BANK_ACCOUNT_NUMBER` | Ten-digit account number, entered as text |
   | `EMAIL_ENABLED` | Optional; leave `false` while sending order messages manually |
   | `GMAIL_ADDRESS` | Optional Gmail address for account resets and consultation messages |
   | `GMAIL_APP_PASSWORD` | Gmail App Password (never the account login password) |
   | `GMAIL_FROM_NAME` | Optional sender display name |
   | `PUSH_VAPID_PRIVATE_KEY` | Private key generated by `node scripts/generate-vapid.mjs` |
   | `PUSH_CONTACT_EMAIL` | Contact email for the push service; can match `ADMIN_EMAIL` |

4. Deploy the site. The API creates its tables and illustrative starting content once. It never re-seeds an existing store. Checkout remains unavailable until the bank, Cloudinary, and push settings are valid and an admin device is subscribed.

   The storefront cannot load without `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: the hosted API returns HTTP 503 until both are set. Add them before sharing the Netlify URL.
5. Open `/admin` and sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The one-time setup endpoint is disabled while these variables are set. Change the password in Netlify to rotate it; old admin sessions then stop working. Keep these values out of the repository and public site.
6. Add product categories and their order in **Admin → Settings → Collections**. Enter one path per line, such as `Face > Cleansers`; single names make direct menu links. Brands and skin concerns are editable there too. Upload new JPG, PNG, and WebP images through admin to Cloudinary. Turso stores only structured records and image references. New payment-proof images use Cloudinary authenticated storage and are downloaded only through the admin API. PDF guide uploads remain in Netlify Blobs; previously uploaded images and proofs remain readable there. Bundled demo photos stay in the repository until replaced. Payment proofs are limited to 3 MB.
7. Before sharing checkout, place a small controlled test order: check the bank name and number on the deployed payment screen against your bank's own records; submit a test receipt; confirm that both owner push alerts arrive; verify that the admin cannot issue a receipt before proof submission; then confirm a real bank credit, prepare the customer message in admin, and send it yourself. Check that its private receipt link works. Keep sample products hidden until their prices, stock and fulfilment terms are real.

Netlify's default Node.js 24 runtime is supported. If your existing Netlify site is pinned to an older runtime, set `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` through Netlify's environment settings. Do not put this variable in `netlify.toml`.

**Deploy Preview isolation:** use a separate Turso database/token and Cloudinary cloud for Netlify Deploy Previews. Production and preview PDF/legacy uploads use separate blob store names. Do not point test deployments at real customer data. Avoid setting real bank details and live Gmail credentials on Deploy Previews. The first local SQLite catalogue is not automatically transferred to Turso; edit the hosted catalogue after setup or plan a deliberate data migration.

## Connect Cloudinary

1. In the [Cloudinary Console](https://console.cloudinary.com/), open **Settings → API Keys** for your product environment. Copy its **Cloud Name**, **API Key**, and **API Secret**. This site uses three separate variables; it does not need an unsigned upload preset or a combined `CLOUDINARY_URL` value.
2. In Netlify, open **Project configuration → Environment variables** for this site. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` with the matching values. If Netlify offers variable scopes, include **Functions**. Keep the secret out of source files, chat, and `netlify.toml`.
3. Trigger a new deploy so Netlify Functions receive the values. Sign in to `/admin`, upload a small JPG, PNG, or WebP product image, and check that it appears in Cloudinary under `drealskinhub/products`. Payment receipts use the `authenticated` delivery type under `drealskinhub/payment-proofs` and are downloaded through the protected admin API. They cannot be tested until checkout's bank and push settings are also ready.

## Owner push alerts and manual customer messages

1. Run `node scripts/generate-vapid.mjs` **locally**, then copy the generated `PUSH_VAPID_PRIVATE_KEY` to Netlify and set `PUSH_CONTACT_EMAIL` to an address you control. The private key must remain server-side. Keep a secure copy: changing it invalidates existing browser subscriptions.
2. Redeploy, sign in at `/admin`, and use **Order alerts on this device → Enable notifications**. Allow the browser permission, then send a test alert. On iPhone, first add the admin page to the Home Screen and open the installed app. Repeat on any additional admin device. A configured key alone does not open checkout; at least one device must be subscribed.
3. In **Admin → Orders**, open an order and choose **Prepare email draft** or **Prepare WhatsApp message**. The draft uses the customer's preferred channel and, when relevant, creates a private payment or receipt link. Review the text, then send it from your own email or WhatsApp app. Preparing a draft never sends it. After confirming a bank transfer, return to the order to prepare and send the payment confirmation yourself.
4. Test a complete order and payment-proof upload on the deployed site. Confirm the two owner push alerts, verify a bank transfer, and check the manually prepared receipt link. Browser/OS settings and connectivity can delay push, so check `/admin#orders` routinely as well.

Keep `EMAIL_ENABLED=false` for now. Gmail remains an optional adapter for password resets and preview consultation messages; it does not send order messages, even if enabled. Password-reset links are single-use and expire in 30 minutes. Subscriber forms save consent and addresses, but welcome messages and newsletters are not sent automatically. If you later enable Gmail for those other transactional messages, use a dedicated Gmail account with 2-Step Verification and an App Password, stored only in Netlify environment variables.

For local provider testing, copy `.env.example` to `.env` and configure it privately. `npm start` reads `.env` automatically.

## Admin notes

- **Products:** add/edit products, images, stock, promotions, concerns, and descriptions. Archiving hides a product while retaining its information. Re-enable “Visible in the shop” to restore it.
- **Settings → Collections:** change categories, concerns, and brands. If you rename a collection, update products using that collection too.
- **Orders:** inspect delivery details and download the private payment image. Check the transfer in your own bank account, then enter the bank statement reference, tick the verification box, and generate the PDF receipt. Fulfilment cannot advance before verification. For WhatsApp customers, open the prepared message to share the private receipt link. Cancelling an unpaid order restores stock once; verified payments need a separate refund process.
- **Consultations:** manage bookings; use “Manage availability” to add dated slots in Lagos time. Slots must be at least one consultation duration apart. No fake availability is seeded.
- **Website content:** publish pages, articles, FAQs, and verified reviews. Review sections stay hidden until genuine reviews are published.
- **Settings → Homepage:** update the hero, announcement, homepage section order, product collections, and about introduction. The original supplied logo is retained.
- **Settings → Visibility:** show or hide content sections across the homepage and other pages without deleting their content. Core shopping, payment, account, and policy controls remain available.
- **Photography:** ten compressed Pexels photographs are bundled in `public/assets/photos/` (about 610 KB total), with photographer and licence links in `CREDITS.md`. The hero and consultation photos can be replaced in Settings. Product uploads override representative stock photos on labelled sample products. Category and journal imagery uses the bundled collection. No external image host is contacted by the browser.
- **Visual system:** `public/design.css` defines the shared text scale, controls, layout spacing, image treatment, and admin refinements. Body text is 16–18 px, inputs are 16 px, normal controls are 15–16 px, and supporting captions are 12–14 px. Small decorative text in the logo and fallback packaging is separate from interface text.
- **Settings → Skincare guide:** upload the owner-approved PDF. The link appears after guide signup; automatic guide email is not connected.
- **Subscribers:** view consent/source, tag, unsubscribe, and export CSV. Newsletter sending is not connected.
- **Data:** the JSON export includes store records but excludes passwords/session/reset tokens and uploaded file bytes. It is a portable export, not a full database restore. Back up the database and media separately.

## Verification

```powershell
npm.cmd run check
npm.cmd test
```

Tests cover authentication/authorisation, cross-origin write rejection, pricing, inventory, duplicate submissions, stock restoration, discount limits, customer data isolation, appointment collisions, signup deduplication/consent, CRUD, upload validation, password resets, Gmail SMTP, push authentication/VAPID signing, Turso transaction rollback/batching, legacy Sender adapter behavior, and Netlify setup security.

Earlier visual checks were completed in installed Chrome at **320 × 740, 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900, and 1900 × 900**. The isolated localhost visual script now exercises bank-transfer checkout with a clearly fake test account. This bank-transfer change was validated with syntax and API tests; it has not been rendered or screenshot-tested yet. The visual browser blocks external page requests.

Run `npm.cmd run test:visual` to repeat this check with an installed Chrome/Edge (or set `VISUAL_BROWSER` to its executable). No browser download is needed. Results and screenshots are written to `.cache/visual/`. These are Chromium viewport checks; physical iOS/Safari and Android device testing remains a separate pre-launch check.

## Code layout

```text
public/                  Storefront, admin interface, styles, supplied brand assets
server.mjs               Shared API and local HTTP server
lib/database.mjs         Local SQLite / hosted Turso adapter, transaction batching
lib/seed.mjs             Clearly labelled starting content
lib/gmail.mjs            Customer transactional email through Gmail SMTP
lib/push.mjs             Owner web push with VAPID authentication
lib/sender.mjs           Dormant legacy Sender marketing adapter
lib/media.mjs            Local / Netlify Blobs PDF and legacy upload storage
lib/cloudinary.mjs       Cloudinary image and authenticated proof storage
netlify/functions/api.mjs Netlify Request/Response adapter
netlify.toml             Hosting routes, security headers, build configuration
test/                    Offline automated tests
data/                    Local runtime data (ignored by Git)
```

Reference documentation: [Netlify Functions](https://docs.netlify.com/build/functions/get-started/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Turso JavaScript SDK](https://docs.turso.tech/sdk/ts/reference), [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference), [Gmail App Passwords](https://support.google.com/accounts/answer/185833), [Gmail sending limits](https://support.google.com/mail/answer/22839), [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
