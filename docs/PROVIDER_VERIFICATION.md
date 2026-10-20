# Provider verification: implementation and deployment

## Actual schema inspected

The mobile project's `types/onsiteMechanicProfile.ts`, `types/towingCompanyProfile.ts`, `types/user.ts`, `services/providerProfileService.ts`, `services/towingCompanyProfileService.ts`, `services/shopOwnerService.ts`, `services/publicProviderListingService.ts`, and Firestore/Storage rules were inspected read-only.

| Provider | Source document | Existing approval contract |
| --- | --- | --- |
| Onsite mechanic | `users/{uid}/providerProfile/profile` | `verificationStatus` (`INCOMPLETE`, `PENDING`, `VERIFIED`, `REJECTED`) |
| Towing company | `users/{uid}/towingCompanyProfile/profile` | Same status enum |
| Vehicle owner | `users/{uid}/ownerProfile/profile` | `verificationStatus` (`PENDING` submitted; admin decision `VERIFIED` or `REJECTED`) |
| Auto shop | `providers/{uid}` | `verified: boolean`; there is no existing application status or submission form |

Mechanic details come from `personal`, `professional`, `identification`, `credentials`. Towing details come from `company`, `services`, `representative`, `businessDocuments`. Shop details are flat business/contact/location fields. `users/{uid}.role` is cross-checked in the transaction and rules; `displayName` is used in details. The admin still requires the existing boolean `admin: true` Auth custom claim; a Firestore admin role alone does not authorize anything.

Mechanics/towing have `submittedAt` and `updatedAt`; shops do not. Missing submission dates display **Not recorded**, never a fabricated timestamp. Legacy unverified shops are labeled explicitly rather than pretending they submitted a PENDING application. Registration placeholders/incomplete shop locations cannot be approved.

## Queue and details

Three collection-group queries filter `verificationStatus == PENDING` for mechanics, towing companies, and vehicle owners. A fourth query pages `providers` where `role == shop-owner`; the adapter includes only `verified == false` and missing status/PENDING. It excludes rejected, verified, incomplete, wrong-path and UID-mismatched records. Each request reads at most 50 documents per source; **Load more** advances independent cursors. This avoids unbounded listeners/reads on Spark. The displayed count is loaded candidates, not a global count. Rejected/approved shop records can occupy a page; Load more continues the scan.

The table refreshes on mount, manual refresh and completed decisions. Loading/errors/empty states are distinct. A failed query is not shown as an empty database. Details show only a whitelist of review-relevant fields; dates of birth and full government ID numbers are not displayed. Private documents stay in the original profiles.

The actual mobile upload helper currently uses **Cloudinary** and stores HTTPS URLs, despite older Firebase Storage rules remaining in the repository. Links open the stored Cloudinary or Firebase Storage download URL in a new tab with no referrer. There is no upload, Storage SDK dependency, proxy, new paid service, or change to mobile uploads. Unsupported/missing URLs are labeled unavailable. Existing download-token URLs are bearer links; this change does not alter their original access model. A deleted file or unavailable external host can still fail to open. There are no shop document fields to display.

## Decisions

**Approve:** View the submitted profile, select Approve, then Confirm decision. The existing Auth account and admin claim are checked. A Firestore transaction reads the current profile, account role, and public listing. It compares the entire reviewed submission to the current document, aborting if changed or already decided. It updates only:

- `verificationStatus: VERIFIED`
- `reviewedAt: serverTimestamp()`
- `reviewedBy: current admin UID`
- `rejectionReason: ""`
- Shops additionally get `verified: true` to preserve mobile compatibility.

**Reject:** Select Reject, enter a trimmed 5–500 character reason, then Confirm decision. The same checks and transaction run, writing `verificationStatus: REJECTED`, the reason, `reviewedAt`, `reviewedBy`, and `verified: false` for shops. The decision removes the provider from the pending queue and triggers refresh. Errors retain details/reason for retry.

`reviewedAt`, `reviewedBy`, and `rejectionReason` are explicitly added optional fields; there were no existing decision metadata fields. Shop `verificationStatus` is an additive field; existing screens continue using `verified`. Existing `submittedAt`, `updatedAt`, personal/business information, attachments, account roles, and bookings are not overwritten. These fields describe the latest decision, not an immutable audit ledger. Existing mechanic/towing resubmission uses a replacing `setDoc`, so old decision metadata can be removed on resubmission.

## Public listings

The existing implementation is **verified profile → provider's Public Listing form → providerListings → customer map**. The admin does not invent a public listing, publish a submitted address/document, or use default coordinates. If a listing already exists, either decision atomically changes only `visibility` to `inactive`, preserving every other field. No listing is deleted. Approved providers can then republish using the existing mobile form and its rules-validated fields. A rejection cannot commit while leaving an existing listing active. Opening the queue/details performs no writes.

This release handles pending decisions, not revocation of already-approved accounts. It does not backfill legacy stale listings or change the existing mobile resubmission behavior. The original system can leave an older active listing during resubmission; this review flow hides it when the decision commits.

## Recent bookings dashboard

The Recent bookings panel reads the latest seven documents from `bookings`, ordered by `createdAt` descending. It displays the booking ID, customer/provider display names, booking type, status, and creation time. It requires the same `admin: true` Auth custom claim as provider verification. Firestore rules grant admins booking `get`/`list` access; ordinary users remain restricted to records where they are the customer or provider. Deploy the updated rules before expecting the panel to load. The query uses Firestore's built-in single-field `createdAt` index and needs no additional composite index.

The dashboard summary cards use server-side Firestore count aggregations for all `users`, pending mechanic/towing/shop applications, active `providerListings`, and all `bookings`. Service Providers breaks active public listings down by provider role. Pending legacy shops without a formal `PENDING` status appear in the verification queue but are not counted as submitted pending applications. Admin list access to `users` and shop profiles is required for these aggregates; both rules are limited to the trusted admin claim. Counts update when the dashboard loads; use page refresh to retrieve them again.

The Onsite Mechanics, Auto Shops, and Towing Companies sidebar destinations are separate live directory routes. Each lists active public provider listings for its role, with search and refresh. Their role/visibility query uses the `providerListings` composite index in `firestore.indexes.json`; deploy the updated indexes before opening these pages.

Each directory also exposes an admin-controlled `active`/`suspended` account status stored on `users/{uid}`. Suspending hides an active public listing in the same transaction; restoring the account does not republish that listing. Every status transition creates an immutable `providerStatusHistory` record with the provider, role, previous/new status, timestamp, and reviewing admin UID for future reports. This status is an administrative Firestore flag; it does not disable Firebase Authentication sign-in. Account status updates, listing hides, status-history writes, and admin listing reads are protected by the admin custom claim and the deployed Firestore rules.

The admin Notifications page listens for pending mechanic/towing applications, recent booking creations/status updates, provider verification decisions, and provider account suspensions/restorations. The header bell shows unread items; read IDs are stored in the current browser. Approval/rejection writes an immutable `providerVerificationHistory` event in the same transaction as the decision. Notifications are in-app only and do not include subscription payments or external push delivery.

## Rules and deployment

`firestore.rules` starts with a complete copy of the mobile rules and adds only:

1. Strict custom-claim `isAdmin()`.
2. Admin list access for the three PENDING collection groups, users and shop profiles for count metrics, and provider listings for status administration; single-document reads for provider/owner accounts and private verification profiles.
3. Admin-only pending/legacy-shop decision updates, with UID/role agreement, allowed-field diff, mandatory request-time timestamp/current reviewer, status/reason validation, shop boolean consistency and complete shop-location checks. Vehicle-owner reviews use the same constrained decision metadata and immutable verification-history trail without changing provider listings. Provider account status updates and immutable status-history creation are also admin-only; provider self-updates cannot change admin status metadata.
4. Transaction enforcement that an existing listing is inactive after review or account suspension; the matching admin listing update can only change visibility to inactive alongside the corresponding review/status change.
5. `visibility` in the existing provider listing update field allowlist. All existing verified-provider, public shape, category, location and value checks still apply. This permits approved providers to republish an inactive listing as active.

All other mobile collection rules and default denial are preserved. No broad admin write wildcard was added. Storage rules were not changed. No mobile files were edited.

The deployed rules were read on 2026-09-10 and matched the mobile baseline exactly (after newline normalization). Copies are `docs/firestore.mobile-baseline.rules` and `docs/firestore.deployed-baseline.rules`. The current deployed index definitions were also read and were empty. No production rules, indexes, or provider decisions were deployed/written by this implementation task.

Review the diff before deploying:

```powershell
cd C:\Users\mypc\VeResc-Admin
git diff --no-index -- docs/firestore.mobile-baseline.rules firestore.rules
firebase.cmd deploy --only firestore:rules,firestore:indexes --project veresc-16c53
```

If PowerShell splits the comma, use `--only "firestore:rules,firestore:indexes"`. Wait for both collection-group indexes to finish building before loading the queue. This deployment changes the shared project's rules, so preserve this merged version as the authoritative source; deploying the old mobile copy later would remove admin permissions. If production rules/indexes have changed since inspection, merge those changes before deployment. No Hosting, Functions, Storage, or billing change is needed.

## Validation and local testing

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:rules
```

Rules tests require the Firebase CLI and Java 21+. A portable Java runtime was downloaded to the ignored `.tools/java21` directory without changing the system Java installation. To use it in this session:

```powershell
$verificationJava = Get-ChildItem .tools/java21 -Directory | Select-Object -First 1
$env:JAVA_HOME = $verificationJava.FullName
$env:PATH = "$($verificationJava.FullName)\bin;$env:PATH"
npm.cmd run test:rules
```

The tests use only `demo-veresc-admin` on the local emulator. They cover all verification queries, provider and vehicle-owner decisions, rejected reasons/metadata, no privileged access through role-only/string claims, denial of unrelated writes, atomic listing hiding, mobile private reads/resubmissions and publishing after verification. Unit tests cover schema adapters, malformed paths, stale submission comparison, shop readiness, URL safety, and the existing Auth validation/claim logic.

After deploying, run `npm.cmd run dev`, sign in with an approved account, and use real submitted test applications to check View → Approve/Reject → confirmation → refreshed queue. Use a different normal account to confirm `/admin` stays guarded. Logout should still return to `/login`. Live browser sessions and real provider decisions were not exercised automatically; this task deliberately did not approve/reject production people merely for testing.

## Remaining limitations

- Shops have no mobile rejection-reason display or resubmission action. After independently verifying corrected shop details, a trusted Console operator can set its new `verificationStatus` to `PENDING` for re-review; `verified` remains false. No automatic migration or fake application is created.
- Mechanic/towing apps can resubmit via their existing forms; existing mobile screens do not display the newly saved rejection reason yet.
- The app does not automatically publish listings after approval; the provider uses its existing Public Listing screen.
- Custom claims retain the existing token-expiry revocation behavior. There is no new auth system.
- Dashboard summary cards, booking table, provider counts and activity chart remain explicitly mock. Only provider verification is live.

References: [Firebase collection-group security](https://firebase.google.com/docs/firestore/security/rules-query), [index definitions](https://firebase.google.com/docs/reference/firestore/indexes), [rules emulator testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
