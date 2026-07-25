import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Source files must be plain text.
 *
 * Not a style rule. `src/lib/security/identity.ts` used a raw NUL byte as the
 * separator in its HMAC input — correct cryptographically, invisible in an
 * editor, and enough to make `file`, grep, ripgrep, ugrep and GitHub's own diff
 * view classify the file as binary.
 *
 * The consequence was not cosmetic. Repository-wide scans skip binary files by
 * default, so that module was silently absent from every one of them, including
 * the search for leaked credentials run immediately before this repository was
 * made public. A file that tooling cannot read is a file nobody reviews, and
 * this project asks to be audited.
 *
 * Control characters belong in source as escapes. They behave identically at
 * runtime and stay legible to both people and tools.
 */

const TEXT = /\.(ts|tsx|js|jsx|css|md|json|sql|yml|yaml|sh|html|svg)$/;

function trackedTextFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => f && TEXT.test(f));
}

// Everything outside printable ASCII and ordinary whitespace. Legitimate
// non-ASCII text (em dashes, accented names) is UTF-8 and excluded by range.
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

describe("every source file is readable by text tools", () => {
  const files = trackedTextFiles();

  it("finds files to check", () => {
    // A broken glob here would make the suite below vacuously pass.
    expect(files.length).toBeGreaterThan(50);
  });

  it("contains no raw control characters", () => {
    const offenders = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.flatMap((line, i) => {
        const match = CONTROL.exec(line);
        if (!match) return [];
        const code = match[0].codePointAt(0)!.toString(16).padStart(4, "0");
        return [`${file}:${i + 1} contains U+${code.toUpperCase()} — write it as an escape`];
      });
    });

    expect(offenders).toEqual([]);
  });
});
