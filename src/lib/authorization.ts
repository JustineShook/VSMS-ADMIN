/** Only a boolean claim issued by trusted Firebase Admin SDK code grants access. */
export function hasAdminClaim(claims: Record<string, unknown>): boolean {
  return claims.admin === true;
}
