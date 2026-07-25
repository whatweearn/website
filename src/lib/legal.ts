/**
 * Who is legally responsible for this site.
 *
 * GDPR requires an identifiable data controller with a working contact
 * address. An organisation name on a repository does not discharge that, and
 * neither does a privacy policy that says "we".
 *
 * These come from the environment rather than being hard-coded so the answer
 * is a deployment decision made deliberately — and when they are missing, the
 * pages say so loudly rather than rendering a policy with a hole in it. A
 * privacy policy that quietly omits its controller is worse than none: it
 * looks compliant.
 */

export type Controller = {
  name: string;
  email: string;
  /** Postal address or jurisdiction. Optional, but expected for a real launch. */
  address?: string;
};

export function getController(): Controller | null {
  const name = process.env.LEGAL_CONTROLLER_NAME;
  const email = process.env.LEGAL_CONTACT_EMAIL;
  if (!name || !email) return null;
  return { name, email, address: process.env.LEGAL_CONTROLLER_ADDRESS };
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SOURCE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL ?? "https://github.com/whatweearn/website";
