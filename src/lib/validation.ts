export type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>>;
export function validateCredentials(values: { name: string; email: string; password: string; confirmPassword: string }, register: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (register && (values.name.trim().length < 2 || values.name.trim().length > 120)) errors.name = 'Enter your full name (2–120 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (register && values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (register && (!values.confirmPassword || values.password !== values.confirmPassword)) errors.confirmPassword = 'Passwords must match.';
  return errors;
}
