# Deploy Zerebro Campus to Vercel

These are the one-time steps to get `@zerebro/campus` running on a Vercel
project. Subsequent deploys are automatic on every push to the configured
branch.

> Run any `firebase deploy` commands separately -- this guide only covers
> the Next.js web app on Vercel. The Firestore rules + indexes still ship
> from the repo root with `firebase deploy --only firestore`.

## 1. Create the Vercel project

1. Vercel Dashboard -> **Add New -> Project**.
2. Import the `KidSafe` Git repo.
3. **Configure**:
   - **Root Directory**: `apps/principal-web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build / Install / Output**: leave blank -- `vercel.json` in this
     directory overrides them with monorepo-aware versions:
     - `installCommand: cd ../.. && pnpm install --frozen-lockfile`
     - `buildCommand:   cd ../.. && pnpm --filter @zerebro/campus build`
     - `outputDirectory: .next`
     - `ignoreCommand` -- skips a deploy when the diff touches none of
       `apps/principal-web`, `packages/shared-firebase`,
       `packages/shared-types` (saves build minutes on no-op pushes).

## 2. Environment variables

Add all six `NEXT_PUBLIC_FIREBASE_*` keys from
[`.env.example`](.env.example) to **Project Settings -> Environment
Variables**, scoped to all three environments (Production, Preview,
Development). Values come from:

> Firebase Console -> Project settings -> General -> Your apps -> Web app

If the project has no web-app registration yet, click **Add app -> Web**
in the Firebase Console and skip the Firebase Hosting step.

## 3. Production domain

In the Vercel project's **Domains** tab:

1. Add `campus.zerebrokid.com` (or `campus-staging.zerebrokid.com` for
   the staging deploy).
2. Vercel prints the DNS record to add at your registrar -- typically a
   single `CNAME` pointing at `cname.vercel-dns.com`.

## 4. Firebase Auth callback domains

Firebase Phone Auth refuses to send SMS if the calling origin is not on
the **Authorized domains** list:

> Firebase Console -> Authentication -> Settings -> Authorized domains

Add the production + preview domains there once they exist.

## 5. Smoke test

After the first successful deploy:

1. Open `https://campus.zerebrokid.com` -- it should redirect to
   `/login` and render the phone-OTP form.
2. Enter your phone number, complete the OTP round-trip.
3. After verify, you land on `/dashboard` (Coming soon panel).
4. The sidebar's **Sign out** button should bounce you to `/login` and
   stay bounced on a hard refresh.

## 6. Roll back

`vercel rollback` from the CLI -- or **Deployments -> [pick one] ->
Promote to Production** in the dashboard. Vercel keeps every deploy
immutable so rollback is free.
