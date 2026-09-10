# VeResc Admin

**Current update:** Provider verification is now implemented with real Firestore queries and transactional approval/rejection. Deploy the reviewed rules and indexes before using it. See [provider verification setup, schema, limitations and tests](docs/PROVIDER_VERIFICATION.md). Other dashboard sections remain static. The dashboard-preview notes below describe the preceding release; verification controls and its sidebar link are now active.

Independent React + Vite + TypeScript admin web application, using Tailwind CSS, Lucide React, and Firebase project **veresc-16c53**. Approved administrators now reach a visual dashboard preview at `/admin`. All operational data is fictional and static. The dashboard adds no Firestore connections, CRUD operations, Security Rules changes, or dependencies. The existing authentication implementation and mobile project remain unchanged.

## Run locally

Use Node 24 LTS (used here). Vite itself supports Node 20.19+ or 22.12+, but the dependency-free TypeScript test command requires a recent Node version with type stripping. In PowerShell:

```powershell
cd C:\Users\mypc\VeResc-Admin
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. `.env.local` was prepared during setup; only copy the example again if needed. Restart Vite after changing environment variables. The example contains the existing project's public web configuration; Firebase web API keys are not server credentials. Never put service-account keys in Vite environment variables.

Email/Password sign-in must be enabled in Firebase Authentication. Confirm localhost is an authorized domain where required by your project's Auth configuration. No Firebase Storage, Analytics, Admin SDK, or additional backend is initialized. `src/lib/firebase.ts` exposes Firestore for future services without performing data operations.

**Local forms connect to the real shared Firebase project.** Registering creates a real Auth account. Use a dedicated test email; no test accounts or backend fixtures are created by the automated checks.

## Test the flows

1. **Login:** Visit `/login`. Submit blank or malformed values to see validation; toggle password visibility. Try incorrect credentials to see Firebase errors, then sign in with an existing VeResc account. Normal mobile accounts reach **Admin approval required**.
2. **Registration:** Visit `/register`. Test a short password and mismatched confirmation. Register a dedicated test account with a full name, valid email, and matching passwords of at least 8 characters. Firebase's configured password policy is also enforced. The result is a signed-in account awaiting approval, with no admin claim and no Firestore profile write. Duplicate emails produce a sign-in message.
3. **Protected routes:** Open `/admin` signed out; expect `/login`. Open it with an ordinary user, including one with only `users/{uid}.role = "admin"`; expect `/access`. Only a trusted boolean custom claim grants the dashboard preview. Never change production roles just to test this case.
4. **Approved staff:** Sign in with an approved account, or choose **Refresh access** after trusted approval. Expect `/admin` with the sidebar, summary cards, static chart, booking table, and provider verification preview. Approval setup is documented in `docs/AUTHORIZATION.md`; this UI cannot approve itself.
5. **Logout:** Select **Log out** at the bottom of the dashboard sidebar (or **Sign out** on the access screen). Expect `/login`. Reload or revisit `/admin`; access stays blocked. Reloading before logout preserves the session in the same tab.
6. **Resilience and layout:** Try browser offline mode during login/access refresh, keyboard-only navigation, and a narrow viewport. Failed claim checks must not render protected content.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Automated tests cover strict claim authorization and validation. They do not call Firebase. Live credentials, approval, and deployed-rule behavior require the manual checks above; no production mutations are made to verify them.

## Inspect the dashboard preview

- Desktop: collapse/expand the left sidebar; open the profile dropdown and dismiss it with Escape or an outside click.
- Tablet/mobile: use the menu button to open navigation; close it with the X, Escape, or backdrop. The modal keeps keyboard focus inside navigation while open.
- Cards stack on smaller screens; tables scroll horizontally within their panels and are keyboard-focusable.
- Search, notifications, management navigation, and review buttons are visual placeholders and intentionally disabled. They do not query or modify anything.
- Operational sample data lives in `src/data/dashboardMock.ts`. The signed-in admin name/avatar uses the existing Auth session; no profile document is fetched.

## Files

- `src/components/`: auth provider, brand, accessible form field, loading indicator.
- `src/layouts/AuthLayout.tsx`: responsive red-and-white account layout.
- `src/layouts/AdminLayout.tsx`: dashboard shell, responsive navigation, and existing logout integration.
- `src/components/admin/`: reusable sidebar, header, avatar, status badge, summary card, booking and verification tables, provider overview, and static activity chart.
- `src/pages/DashboardPage.tsx`: visual dashboard composition.
- `src/data/dashboardMock.ts`: clearly labeled fictional operational data.
- `src/pages/`: login/registration form and account access/logout page.
- `src/routes/`: routing and deny-by-default protected-route foundation.
- `src/services/auth.ts`: Firebase login, registration, logout, and friendly errors.
- `src/hooks/`, `src/types/`: shared auth state interface.
- `src/lib/`: Firebase initialization, strict claim check, form validation.
- `src/styles.css`: Tailwind theme and shared controls.
- `tests/`: local authorization and validation checks.
- `docs/AUTHORIZATION.md`: inspected role structure, security finding, approval and future rules plan.

Read the authorization document before adding any admin data module. Client guards do not replace Firestore Security Rules. Hosting deployment is intentionally deferred.
