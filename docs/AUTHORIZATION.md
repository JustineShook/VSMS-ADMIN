# Authorization foundation

**Current update:** The existing custom claim now authorizes scoped provider review reads/writes through the proposed merged Firestore rules. See [PROVIDER_VERIFICATION.md](PROVIDER_VERIFICATION.md) for the current rules, deployment, and validation. The authentication-only and visual-preview notes below are historical context.

Dashboard preview update: `/admin` now renders a static dashboard instead of the original session confirmation. All operational entries are explicitly labeled fictional mock data. The same custom-claim route guard remains in place; no Firestore reads, writes, or rule changes were added. References below to the original confirmation page describe the authentication-only release.

## Existing mobile application (read-only inspection)

Inspected `C:/Users/mypc/VeResc/types/user.ts`, `services/auth.ts`, `services/firebase.ts`, and `firestore.rules`. No mobile files were modified.

- Shared Firebase project: `veresc-16c53`.
- `users/{uid}` stores `uid`, `email`, `displayName`, `role`, and `createdAt` (registration writes a server timestamp).
- Roles: `owner`, `onsite-mechanic`, `shop-owner`, `towing-company`, `admin`.
- Mobile registration omits admin from the selectable roles. Routing reads the Firestore role.
- The inspected rules let an owner create their own user document with a matching UID **without restricting the initial role**. Updates preserve the role, but that does not prevent an initial `admin` value. A role document alone is therefore insufficient evidence of staff privileges.
- These are local rules, not a verified copy of deployed rules. This implementation neither retrieves nor deploys production rules.

## Chosen foundation

Only a Firebase ID token with the strict boolean custom claim `admin: true` unlocks the protected route. A role document, email address, display name, successful signup, local storage value, or string claim `"true"` never grants access. Custom claims must be assigned by trusted Firebase Admin SDK tooling outside the browser, after verifying the staff member's identity. No service account or Admin SDK belongs in this Vite bundle.

Registration creates only a Firebase Authentication identity and display name. It does not create `users/{uid}`, an admin request document, or any privileged data. The approval screen is an account state, not a submitted review ticket; users must contact their administrator with the displayed UID. Existing mobile accounts should sign in instead of registering again. New website accounts will have no mobile role/profile until a separate authorized onboarding process creates one.

The frontend observes ID-token changes, denies access while verification is pending or fails, and ignores stale asynchronous checks after account changes. A refresh button forces token renewal following approval. Sessions use browser session persistence, surviving reloads in the same tab but ending when the tab/window is closed. Logout calls Firebase signOut.

## Trusted approval process (not executed by this project)

1. Independently verify the person and their Firebase UID in project `veresc-16c53`.
2. From a trusted Admin SDK environment, read the user's existing custom claims, then set `{ ...existingClaims, admin: true }`. `setCustomUserClaims` replaces the claims object, so preserve unrelated claims.
3. Have the staff member select **Refresh access** or sign out and sign back in.
4. If mobile compatibility requires `users/{uid}.role = "admin"`, handle that separately through trusted tooling; that field is not web authorization.

Do not automatically promote accounts based on the currently writable-at-creation role field. Review existing admin-role identities before migration.

## Firestore enforcement before adding admin data

No database permissions have been widened. The protected page contains only the signed-in account's Auth information and no dashboard/data modules. A React route guard is a UX boundary, **not** database security.

Before any admin data feature, integrate a claim check into the single authoritative shared ruleset and grant only the specific reads/writes that feature needs. This illustrative helper belongs inside `/databases/{database}/documents`:

```rules
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

Use `isAdmin()` on explicit collection operations, with field validation and immutable-field restrictions appropriate to those operations. Do not add a recursive admin read/write wildcard. Keep mobile permissions and default denial intact. Also harden the existing `users/{uid}` creation condition to require a registerable mobile role (owner, onsite-mechanic, shop-owner, towing-company); do this in the shared rules source with mobile regression tests. Do not replace the entire production ruleset with a standalone admin rules file. Firestore combines overlapping allows with OR, so an added deny cannot cancel an existing permissive rule.

Test the merged rules in Firebase Emulator Suite: unauthenticated users, normal users, a forged role document, a string admin claim, genuine admins, and prohibited writes. Only deploy reviewed rules against the shared project. This repository deliberately has no deployable Firestore rules or Firebase Hosting config yet, avoiding accidental replacement of mobile rules or the existing Hosting site.

Claim revocation is not instantaneous for existing ID tokens (normally up to one hour). Before sensitive production modules, design and test prompt revocation, for example an additional server-controlled staff authorization document checked by rules, alongside the claim, or a rules-enforced revocation timestamp. Client refresh is not a security guarantee. MFA and verified staff onboarding can be layered into that production policy.

References: [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [Security Rules basics](https://firebase.google.com/docs/rules/basics), [session management](https://firebase.google.com/docs/auth/admin/manage-sessions).
