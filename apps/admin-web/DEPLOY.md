# Deploy Zerebro Admin to Vercel

One-time steps to get `@zerebro/admin` running on a Vercel project.
Subsequent deploys are automatic on every push to the configured branch.

> Run any `firebase deploy` commands separately -- this guide only covers
> the Next.js web app on Vercel.

## 1. Create the Vercel project

1. Vercel Dashboard -> **Add New -> Project**.
2. Import the `KidSafe` Git repo (same repo as Zerebro Campus -- Vercel
   supports multiple projects from one repo).
3. **Configure**:
   - **Root Directory**: `apps/admin-web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build / Install / Output**: leave blank -- `vercel.json` in this
     directory overrides them:
     - `installCommand: cd ../.. && pnpm install --frozen-lockfile`
     - `buildCommand:   cd ../.. && pnpm --filter @zerebro/admin build`
     - `outputDirectory: .next`
     - `ignoreCommand` -- skips a deploy when the diff touches none of
       `apps/admin-web`, `packages/shared-firebase`,
       `packages/shared-types`.

## 2. Environment variables

Add the six `NEXT_PUBLIC_FIREBASE_*` keys from
[`.env.example`](.env.example) to **Project Settings -> Environment
Variables** for all three environments. Both Admin and Campus point at
the SAME Firebase project, so the values are identical.

## 3. Production domain

**Domains** tab:

1. Add `admin.zerebrokid.com` (or `admin-staging.zerebrokid.com` for
   staging).
2. Configure the CNAME at your DNS provider.

## 4. Firebase Auth callback domains

Add the admin domains to:

> Firebase Console -> Authentication -> Settings -> Authorized domains

## 5. Smoke test

After the first successful deploy:

1. Open `https://admin.zerebrokid.com` -- redirects to `/login`.
2. Sign in with your phone number; verify the OTP.
3. Land on `/schools` (Coming soon panel). All five sidebar items
   (Schools, Syllabus sources, Rewards, Users, Audit) should navigate
   without bouncing back to login.
4. **Sign out** in the sidebar footer -> `/login` and stays there on a
   hard refresh.

## 6. Roll back

`vercel rollback` from CLI -- or **Deployments -> [pick one] -> Promote
to Production**.

## 7. Access control

Until Phase 3's role-switcher lands, every signed-in phone number can
reach every page. Tighten this by either:

- restricting the Firebase project's **Authentication -> Settings ->
  Authorized domains** to staff-only domains, or
- temporarily gating route renders on a hard-coded list of staff
  numbers inside `(dashboard)/layout.tsx` (delete the gate once Phase 3
  ships).
