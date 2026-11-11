# reviewfinder
A review site for stays, restaurants, bars, and hotels. Photo proof, 0–5 stars, and tags for what actually happened.

## Run locally

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and anon key.
2. Set `ADMIN_EMAIL` and `SUPABASE_SERVICE_ROLE_KEY` for the protected admin report queue. The service role key is only read in `app/admin/service.ts`.
3. Configure Supabase Auth email/password sign-up and sign-in for the project.
4. Create a Storage bucket named `review-photos`. Allow authenticated users to upload only under `{auth.uid()}/{review_id}/...`; allow reads for published review photos so public subject pages can display them. The app creates signed photo URLs and never imports listing images.
5. Run `npm run dev`.

The app does not create or migrate database tables. It expects the existing schema and RLS policies. `tags` is read-only under the supplied contract, so creating a new tag from the “Other” control will be rejected by RLS until an authorized tag-creation policy exists; no service-role bypass is used for it.
