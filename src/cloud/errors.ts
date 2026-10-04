/** No Supabase session exists for a call that must not mint a new anonymous identity. */
export class MissingCloudSessionError extends Error {
  constructor() {
    super('The existing cloud history is not signed in on this device. Use its recovery code.');
    this.name = 'MissingCloudSessionError';
  }
}

/** The server no longer recognises this device as a member of its writer space. */
export class CloudAccessLostError extends Error {
  constructor() {
    super('Cloud history is not available for this device.');
    this.name = 'CloudAccessLostError';
  }
}

/** Anonymous sign-ins are switched off in the Supabase project, so cloud backup cannot start. */
export class CloudSetupRequiredError extends Error {
  constructor() {
    super('Anonymous sign-ins are disabled for this Supabase project.');
    this.name = 'CloudSetupRequiredError';
  }
}

const SESSION_LOSS_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'bad_jwt',
  'user_not_found',
  'PGRST301',
  'PGRST302',
  'PGRST303',
]);

function errorFields(error: unknown): { name?: unknown; code?: unknown; message?: unknown } | null {
  return error && typeof error === 'object' ? (error as { name?: unknown; code?: unknown; message?: unknown }) : null;
}

/** True when the device's sign-in is gone or rejected, rather than the network failing. */
export function isSessionLossError(error: unknown): boolean {
  if (error instanceof MissingCloudSessionError || error instanceof CloudAccessLostError) return true;
  const fields = errorFields(error);
  if (!fields) return false;
  if (fields.name === 'MissingCloudSessionError' || fields.name === 'CloudAccessLostError' || fields.name === 'AuthSessionMissingError') return true;
  return typeof fields.code === 'string' && SESSION_LOSS_CODES.has(fields.code);
}

/** True when Supabase Auth refuses anonymous sign-ins for the project. */
export function isAnonymousDisabledError(error: unknown): boolean {
  if (error instanceof CloudSetupRequiredError) return true;
  const fields = errorFields(error);
  if (!fields) return false;
  if (fields.name === 'CloudSetupRequiredError' || fields.code === 'anonymous_provider_disabled') return true;
  return typeof fields.message === 'string' && /anonymous sign-ins are disabled/i.test(fields.message);
}
