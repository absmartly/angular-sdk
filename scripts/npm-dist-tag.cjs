#!/usr/bin/env node
"use strict";

// Decides the dist-tag argument for `npm publish` in .github/workflows/publish.yml.
// Prints nothing when the release may become `latest`, otherwise `--tag <name>`.
//
//   node scripts/npm-dist-tag.cjs <version> [<current latest on npm>]
//
// - A prerelease (1.2.0-beta.1) never becomes latest: it is published under its first
//   prerelease identifier when that is alpha/beta/rc, else under `next`.
// - A release whose major is lower than the current latest's (a 1.x patch while 2.x
//   is latest) is published under `latest-v<major>`, so it never becomes latest. (Not
//   `v<major>`: npm rejects dist-tags that are valid semver ranges, and `v1` is one.)
// - A release lower than latest within the same major (1.4.1 while 1.5.0 is latest)
//   is refused, since `npm publish` would move latest backwards. Publish such a
//   backport by hand.
// - No latest on npm (first publish) means the release becomes latest.

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(version) {
  const match = SEMVER.exec(version);
  if (!match)
    throw new Error(`not a semver version: ${JSON.stringify(version)}`);
  return {
    core: [match[1], match[2], match[3]].map(BigInt),
    prerelease: match[4],
  };
}

function compareCore(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] < b.core[i] ? -1 : 1;
  }
  return 0;
}

function distTag(version, latest) {
  const next = parse(version);
  if (next.prerelease !== undefined) {
    const id = next.prerelease.split(".")[0];
    return ["alpha", "beta", "rc"].includes(id) ? id : "next";
  }
  if (!latest) return "latest";
  const current = parse(latest);
  // A stable release outranks a prerelease of the same core version.
  const cmp =
    compareCore(next, current) || (current.prerelease !== undefined ? 1 : 0);
  if (cmp >= 0) return "latest";
  if (next.core[0] < current.core[0]) return `latest-v${next.core[0]}`;
  throw new Error(
    `${version} is lower than latest ${latest} in the same major: refusing to move latest backwards`,
  );
}

module.exports = { distTag };

if (require.main === module) {
  const [version, latest] = process.argv.slice(2);
  try {
    const tag = distTag(version, latest);
    process.stdout.write(tag === "latest" ? "" : `--tag ${tag}`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
