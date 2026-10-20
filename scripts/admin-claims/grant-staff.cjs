const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const uid = process.argv[2];
if (!uid || process.argv.length !== 3) {
  console.error('Usage: node grant-staff.cjs <Firebase-Auth-UID>');
  process.exit(2);
}

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: 'veresc-16c53' });
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const claims = { ...(user.customClaims || {}), admin: true };
  await auth.setCustomUserClaims(uid, claims);
  console.log(`Granted admin access to ${user.email || '(no email)'} (${uid}).`);
  console.log('Ask the staff member to refresh access or sign out and sign back in.');
}

main().catch(error => {
  console.error('Could not grant staff access:', error.message);
  process.exitCode = 1;
});
