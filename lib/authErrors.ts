export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return "That email or password isn't right.";
  if (/user already registered/i.test(message)) return "An account with that email already exists.";
  if (/password should be at least/i.test(message)) return message;
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  return message;
}
