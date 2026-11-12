# Unfilteredpillowtalk
Real reviews with photo proof for stays (Airbnb, Vrbo, and Furnished Finder), hotels, and leases of any term length.

## Run locally

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and anon key.
2. Set `NEXT_PUBLIC_SITE_URL` to the canonical deployment URL for sitemap links.
3. Grant admin access by setting `profiles.is_admin = true` for the appropriate user. Admin pages and actions use the signed-in user's Supabase session and depend on database RLS policies; never expose a service-role key to the app.
4. Configure Supabase Auth email/password sign-up and sign-in for the project.
5. Create a Storage bucket named `review-photos`. Allow authenticated users to upload only under `{auth.uid()}/{review_id}/...`; allow reads for published review photos so public subject pages can display them. The app creates signed photo URLs and never imports listing images.
6. Run `npm run dev`.

The app does not create or migrate database tables. It expects the existing schema and RLS policies, including generated `subjects.name_key` and `subjects.address_key` columns with a unique index on `(kind, name_key, address_key)`. Subjects require `display_name`, `address`, `source_url`, `place_type`, and `price_tier`; leases save their duration in `reviews.lease_months`. `tags` is read-only under the supplied contract, so creating a new tag from the “Other” control will be rejected by RLS until an authorized tag-creation policy exists; no service-role bypass is used for it.
