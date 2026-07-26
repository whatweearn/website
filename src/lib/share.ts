/**
 * The words people actually post.
 *
 * Kept out of the `Share` component because that component is client-side and
 * the server-rendered pages need to build a message from `stats.json` before it
 * ever reaches the browser. It is also worth having them in one place: this is
 * the only copy on the site that goes out under somebody else's name, so it is
 * the copy most worth being able to read end to end.
 *
 * House style for this file only: short plain sentences, no dashes, nothing
 * that reads as written by a brand. The rest of the site has an editorial
 * voice. A person forwarding this to their team channel does not.
 */

import { withArticle } from "./format";
import type { CountryRow } from "./stats";
import { responsesUntilPublish } from "./thresholds";

/** For somebody who has not answered yet, so there is nothing to claim credit for. */
export const GENERAL_MESSAGE =
  "Nobody knows what engineers in Europe actually earn, because nobody says. whatweearn is an anonymous salary survey trying to fix that. Nine questions, about two minutes, and all of it gets published openly.";

/**
 * The message somebody posts after answering.
 *
 * Carries the *gap*, not the achievement. "I answered a survey" asks for a
 * favour. "Germany needs 47 more before its median publishes" makes the
 * reader's two minutes consequential, and points them at one country instead
 * of scattering responses across twenty-seven.
 */
export function gapMessage(country: string, remaining: number, published: boolean): string {
  const named = withArticle(country);
  if (published) {
    return `Just added my salary to whatweearn, an anonymous salary survey for engineers in Europe. ${named}'s numbers are already up. Two minutes, nothing gets linked to you, and every answer makes them sharper.`;
  }
  return `Just put my salary into whatweearn, an anonymous salary survey for engineers in Europe. ${named} needs ${remaining} more before its median publishes. Two minutes, and nothing gets linked to you.`;
}

/**
 * The message for a page a visitor may not have contributed to.
 *
 * Third person throughout, because the landing page and the explorer are both
 * read by people who have not answered, and putting "I just added my salary"
 * in their mouth is the one thing that would make them not send it.
 *
 * Names the country nearest to publishing when there is one. A specific gap
 * gives the reader something their two minutes visibly completes; the generic
 * version gives them a worthy cause, which converts worse.
 */
export function shareMessageFor(nearest?: CountryRow): string {
  if (!nearest) return GENERAL_MESSAGE;
  const remaining = responsesUntilPublish(nearest.responses);
  if (remaining === 0) return GENERAL_MESSAGE;
  return `Nobody knows what engineers in Europe actually earn, because nobody says. whatweearn is an anonymous salary survey trying to fix that, and ${withArticle(nearest.name)} is ${remaining} answers away from publishing a median. Nine questions, about two minutes.`;
}
