#!/usr/bin/env node
"use strict";

// Release checks for .github/workflows/publish.yml. Run from the repository root:
//
//   REF_TYPE=tag REF_NAME=v1.2.3 DRY_RUN=false node scripts/release-plan.cjs
//
// Prints the dist-tag for `npm publish --tag` (`latest` or another name) on stdout and
// exits non-zero, with the reason on stderr, when the release must not be published.
//
// - The ref must be the tag v<package.json version>. A dry run may also run from a
//   branch, where there is no tag to compare.
// - The version must not already be on npm.
// - Dist-tag:
//   - A prerelease (1.2.0-beta.1) never becomes latest: it is published under its
//     first prerelease identifier when that is alpha/beta/rc, else under `next`.
//   - A release whose major is lower than the current latest's (a 1.x patch while 2.x
//     is latest) is published under `latest-v<major>`, so it never becomes latest.
//     (Not `v<major>`: npm rejects dist-tags that are valid semver ranges, and `v1`
//     is one.)
//   - A release lower than latest within the same major (1.4.1 while 1.5.0 is latest)
//     is refused, since `npm publish` would move latest backwards. So is a lower-major
//     release below a stable version already published in its major (1.5.0 when
//     1.6.0 exists), which would move latest-v<major> backwards. Publish such a
//     backport by hand.
//   - Nothing on npm yet (first publish) means the release becomes latest.
//
// npm is queried with `npm view <pkg> dist-tags.latest` and `npm view <pkg> versions
// --json`, whose output has the same shape on npm 11 and 12 (`npm view <pkg> --json`
// does not: npm 12 wraps it in an array). NPM_BIN overrides the npm binary for tests.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

function distTag(version, latest, versions = []) {
  const next = parse(version);
  if (next.prerelease !== undefined) {
    const id = next.prerelease.split(".")[0];
    return ["alpha", "beta", "rc"].includes(id) ? id : "next";
  }
  if (!latest) return "latest";
  const current = parse(latest);
  // Equal cores also become latest: a stable release outranks its own prerelease,
  // and republishing the same version is caught by the already-published check.
  if (compareCore(next, current) >= 0) return "latest";
  if (next.core[0] === current.core[0]) {
    throw new Error(
      `${version} is lower than latest ${latest} in the same major: refusing to move latest backwards`,
    );
  }
  // npm moves the tag to whatever is published under it, so a backport below the
  // newest stable release of its major would move latest-v<major> backwards.
  const newer = versions.find((v) => {
    const other = SEMVER.test(v) && parse(v);
    return (
      other &&
      other.prerelease === undefined &&
      other.core[0] === next.core[0] &&
      compareCore(other, next) > 0
    );
  });
  if (newer) {
    throw new Error(
      `${version} is lower than ${newer}, already published in major ${next.core[0]}: refusing to move latest-v${next.core[0]} backwards`,
    );
  }
  return `latest-v${next.core[0]}`;
}

function checkRef(version, { refType, refName, dryRun }) {
  if (refType === "tag") {
    if (refName !== `v${version}`) {
      throw new Error(
        `tag ${refName} does not match package.json version ${version} (expected v${version})`,
      );
    }
    return;
  }
  if (!dryRun) {
    throw new Error(
      `publishing requires a v* tag ref, got ${refType} ${refName}`,
    );
  }
}

function npmView(npm, args) {
  const result = spawnSync(npm, ["view", ...args], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout.trim();
  // A package that was never published is E404; any other failure (network, auth,
  // registry outage) must not be mistaken for "nothing published yet".
  if (/\bE404\b/.test(result.stderr)) return null;
  throw new Error(
    `npm view ${args.join(" ")} failed (exit ${result.status}):\n${result.stderr}`,
  );
}

function published(npm, pkg) {
  const versions = npmView(npm, [pkg, "versions", "--json"]);
  if (versions === null) return { latest: "", versions: [] };
  const latest = npmView(npm, [pkg, "dist-tags.latest"]) ?? "";
  // A package with a single version prints a string instead of an array.
  return { latest, versions: [].concat(JSON.parse(versions)) };
}

function plan({ version, refType, refName, dryRun, latest, versions }) {
  const notices = [];
  checkRef(version, { refType, refName, dryRun });
  if (refType !== "tag") {
    notices.push(
      `dry run on ${refType} ${refName}: no tag to compare with v${version}`,
    );
  }
  // Also fatal on a dry run: npm publish --dry-run refuses it too, and a rehearsal
  // should fail where the real publish would.
  if (versions.includes(version)) {
    throw new Error(`version ${version} is already published on npm`);
  }
  return { tag: distTag(version, latest, versions), notices };
}

module.exports = { distTag, plan, published };

if (require.main === module) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    );
    const { latest, versions } = published(
      process.env.NPM_BIN || "npm",
      pkg.name,
    );
    process.stderr.write(
      `${pkg.name}@${pkg.version}; latest on npm: ${latest || "<none>"}\n`,
    );
    const { tag, notices } = plan({
      version: pkg.version,
      refType: process.env.REF_TYPE,
      refName: process.env.REF_NAME,
      dryRun: process.env.DRY_RUN === "true",
      latest,
      versions,
    });
    for (const notice of notices) process.stderr.write(`::notice::${notice}\n`);
    process.stderr.write(`dist-tag: ${tag}\n`);
    process.stdout.write(tag);
  } catch (error) {
    process.stderr.write(`::error::${error.message}\n`);
    process.exit(1);
  }
}
