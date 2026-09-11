export const AUTH_ERROR_MESSAGES = {
  not_configured: "Supabase is not configured",
  signin_failed: "Invalid email or password.",
  signup_failed: "Could not create your account. Please try again.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

/** Map allowlisted `?error=` codes to fixed copy. Unknown/free-text values are dropped. */
export function resolveAuthErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (Object.hasOwn(AUTH_ERROR_MESSAGES, raw)) {
    return AUTH_ERROR_MESSAGES[raw as AuthErrorCode];
  }
  return null;
}
