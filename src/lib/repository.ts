import { hasDatabase } from "./db/client";
import { PostgresResponseRepository } from "./db/responseRepository";
import { isHeadlineEligible } from "./stats/eligibility";
import type { SurveyResponse } from "./survey/schema";

/**
 * Where a submission goes.
 *
 * Phase 3 swaps the implementation for Postgres. Everything the route needs is
 * behind this seam so that change touches one file.
 *
 * Note what the stored record does *not* contain: no address, no user agent,
 * no email, no identifier returned to the caller. The same-day handle is here
 * only so a duplicate can be spotted within the day, and it expires with the
 * secret that produced it.
 */
export type StoredResponse = {
  response: SurveyResponse;
  /** Coarse by design — a precise timestamp is a correlation vector (§4). */
  submittedOn: string;
  /** One-way, same-day. Not an identity; cannot be reversed to an address. */
  handle: string;
  /** Cross-field oddities for the review queue. Never blocks a submission. */
  flags: string[];
};

export interface ResponseRepository {
  save(record: StoredResponse): Promise<void>;
  /** Whether this handle already submitted today. */
  hasSubmittedToday(handle: string): Promise<boolean>;
  /**
   * How many usable responses a country has right now.
   *
   * Read live rather than from the nightly file so the confirmation screen can
   * count the response just made. Safe to expose: per-country counts are
   * already published on the data page, and a count is not a figure that
   * manipulation could chase.
   */
  countForCountry(country: string): Promise<number>;
}

/**
 * Development stand-in. Deliberately loses everything on restart: there is no
 * schema yet, and writing survey responses to a file that nobody has designed
 * a retention policy for would be worse than dropping them.
 */
class InMemoryRepository implements ResponseRepository {
  private readonly records: StoredResponse[] = [];
  private readonly handles = new Set<string>();

  async save(record: StoredResponse): Promise<void> {
    this.records.push(record);
    this.handles.add(record.handle);
  }

  async hasSubmittedToday(handle: string): Promise<boolean> {
    return this.handles.has(handle);
  }

  async countForCountry(country: string): Promise<number> {
    // Same rule as Postgres. Divergence between the two implementations is
    // what let the last storage bug through, since the suite exercises this
    // one and production runs the other.
    return this.records.filter(
      (r) =>
        r.response.country === country &&
        isHeadlineEligible({
          contractType: r.response.contractType,
          ftePercent: r.response.ftePercent ?? null,
        }),
    ).length;
  }

  /** Test seam. */
  get size(): number {
    return this.records.length;
  }
}

let repository: ResponseRepository | undefined;

/**
 * Postgres when a database is configured, in-memory otherwise.
 *
 * Chosen once and cached so a misconfigured deployment fails consistently
 * rather than storing some responses and losing others.
 */
export function getRepository(): ResponseRepository {
  repository ??= hasDatabase() ? new PostgresResponseRepository() : new InMemoryRepository();
  return repository;
}

/** Lets Phase 3 install the Postgres implementation, and tests install a fake. */
export function setRepository(next: ResponseRepository): void {
  repository = next;
}

export { InMemoryRepository };
