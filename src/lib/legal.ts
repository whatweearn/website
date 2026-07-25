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
  /** Full legal name including company form. */
  name: string;
  email: string;
  /**
   * Full postal address.
   *
   * A town is not enough. Belgian Book XII and the German DDG both require a
   * *geographic* address at which the operator can actually be reached, which
   * means street and number.
   */
  address?: string;
  /** Belgian enterprise number, which doubles as the VAT number. */
  companyNumber?: string;
  vatId?: string;
  /** Where the company is established, and so which authority supervises it. */
  jurisdiction?: string;
};

export function getController(): Controller | null {
  const name = process.env.LEGAL_CONTROLLER_NAME;
  const email = process.env.LEGAL_CONTACT_EMAIL;
  if (!name || !email) return null;
  return {
    name,
    email,
    address: process.env.LEGAL_CONTROLLER_ADDRESS,
    companyNumber: process.env.LEGAL_COMPANY_NUMBER,
    vatId: process.env.LEGAL_VAT_ID,
    jurisdiction: process.env.LEGAL_JURISDICTION,
  };
}

/**
 * The authority a visitor can complain to.
 *
 * GDPR Article 13 requires telling people this exists, not merely that they
 * have rights in the abstract. Derived from where the controller is
 * established.
 */
export const SUPERVISORY_AUTHORITIES: Readonly<Record<string, { name: string; url: string }>> = {
  BE: {
    name: "Belgian Data Protection Authority (Gegevensbeschermingsautoriteit / Autorité de protection des données)",
    url: "https://www.gegevensbeschermingsautoriteit.be",
  },
};

export function supervisoryAuthority(jurisdiction?: string) {
  return jurisdiction ? SUPERVISORY_AUTHORITIES[jurisdiction] : undefined;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SOURCE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL ?? "https://github.com/whatweearn/website";
