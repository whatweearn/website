/**
 * The words people actually post.
 *
 * Kept out of the `Share` component because that component is client-side and
 * the pages that use it are server-rendered. It is also worth having them in
 * one place: this is the only copy on the site that goes out under somebody
 * else's name, so it is the copy most worth being able to read end to end.
 *
 * **Every message is addressed to the person receiving it, and says what they
 * get.** That sounds obvious and the first version got it wrong: it led with
 * how far some country was from publishing, which asks a stranger to care
 * about our progress bar. Worse, the country was whichever one happened to be
 * nearest the threshold, so a reader in Poland was being told about the United
 * Kingdom. Nobody forwards that, and nobody acts on it.
 *
 * What the reader gets is the same thing the landing page argues: two minutes
 * against a number they are otherwise guessing at, on the side of a table
 * where the other party is not guessing at all.
 *
 * House style for this file only: short plain sentences, no dashes, nothing
 * that reads as written by a brand. The rest of the site has an editorial
 * voice. A person forwarding this to their team channel does not.
 */

import { withArticle } from "./format";
import type { Population } from "./stats/populations";

/**
 * For anyone who has not answered yet, which is everyone reading the landing
 * page and the explorer.
 *
 * Third person throughout: putting "I just added my salary" in the mouth of
 * somebody who has not is the one thing guaranteed to stop them sending it.
 */
export const INVITE_MESSAGE =
  "whatweearn is an anonymous salary survey for engineers in Europe. Nine questions, about two minutes, and you find out what people with your job, level and country are actually paid. Your employer already knows that number.";

/**
 * The message somebody posts after answering.
 *
 * Still leads with what the reader gets, and the country named is the
 * sharer's own rather than a stranger's, because that is the network they are
 * posting into.
 *
 * The pre-publication version is the honest awkward case: there is nothing for
 * the reader to look at yet, so the offer is the number itself and how close
 * it is. That is a real reason to spend two minutes; "help us reach sixty" is
 * not.
 */
export function gapMessage(
  country: string,
  remaining: number,
  published: boolean,
  population: Population = "employee",
): string {
  const named = withArticle(country);
  if (published) {
    return `Just added my salary to whatweearn, an anonymous salary survey for engineers in Europe. Two minutes and you find out what your job and level actually pay in ${named}. Nothing gets linked to you.`;
  }
  // A contractor's two minutes go towards day rates, not the salary median, so
  // the number they quote has to be the one their own answer moved. Sending
  // somebody a gap they cannot close is how a share message stops being true.
  if (population === "contractor") {
    return `Just added my rate to whatweearn, an anonymous survey for engineers in Europe. Two minutes each, and ${named} needs ${remaining} more contractor day rates before any of us can see what the going rate really is.`;
  }
  // The country is kept out of the sentence-initial slot deliberately.
  // `withArticle` returns a lowercase "the Netherlands", which is right in
  // running text and wrong as the first word of a sentence, and capitalising
  // it conditionally is a worse fix than writing a sentence that never needs
  // it.
  return `Just added my salary to whatweearn, an anonymous salary survey for engineers in Europe. Two minutes each, and ${named} needs ${remaining} more before any of us can see what it really pays.`;
}
