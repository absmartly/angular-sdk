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
//   - Any dist-tag other than latest is read back from npm (dist-tags.<tag>), and a
//     release lower than the version it points to now is refused, since publishing
//     would move it backwards.
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
// npm is queried with `npm view <pkg> versions --json` and `npm view <pkg>
// dist-tags.<tag>`, whose output has the same shape on npm 11 and 12 (`npm view <pkg>
// --json` and `dist-tags --json` do not: npm 12 wraps them in an array). NPM_BIN
// overrides the npm binary for tests.

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

// Semver precedence of prerelease identifiers: numeric ones compare numerically and
// rank below alphanumeric ones, and a shorter list that is a prefix ranks lower.
function comparePrerelease(a, b) {
  const x = a.split(".");
  const y = b.split(".");
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const xNum = /^\d+$/.test(x[i]);
    const yNum = /^\d+$/.test(y[i]);
    if (xNum && yNum) {
      if (BigInt(x[i]) !== BigInt(y[i]))
        return BigInt(x[i]) < BigInt(y[i]) ? -1 : 1;
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1;
    } else if (x[i] !== y[i]) {
      return x[i] < y[i] ? -1 : 1;
    }
  }
  return Math.sign(x.length - y.length);
}

function compare(a, b) {
  const core = compareCore(a, b);
  if (core !== 0) return core;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

function prereleaseTag(prerelease) {
  const id = prerelease.split(".")[0];
  return ["alpha", "beta", "rc"].includes(id) ? id : "next";
}

function distTag(version, latest, versions = []) {
  const next = parse(version);
  if (next.prerelease !== undefined) return prereleaseTag(next.prerelease);
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

// npm moves the dist-tag to the version published under it, so refuse a release
// below the version the tag points to now (1.6.0-beta.1 while beta is 2.1.0-beta.3).
// The target is read from the registry, not inferred from versions, because
// `npm dist-tag add` can point any tag at any version.
function checkTarget(version, tag, target) {
  if (!target) return;
  if (compare(parse(target), parse(version)) > 0) {
    throw new Error(
      `${version} is lower than ${target}, the current ${tag} on npm: refusing to move ${tag} backwards`,
    );
  }
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
  // npm view resolves against the latest dist-tag and prints nothing when there is
  // none. The registry sets latest on a package's first publish even under --tag, so
  // this only happens if latest was removed; fail clearly instead of guessing.
  if (versions === "") {
    throw new Error(
      `npm view ${pkg} versions printed nothing: the package has no latest dist-tag. Set one with npm dist-tag add before releasing`,
    );
  }
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

// The version the dist-tag points to now, or "" when the tag does not exist yet.
function tagTarget(npm, pkg, tag) {
  return npmView(npm, [pkg, `dist-tags.${tag}`]) ?? "";
}

module.exports = { checkTarget, distTag, plan, published };

if (require.main === module) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    );
    const npm = process.env.NPM_BIN || "npm";
    const { latest, versions } = published(npm, pkg.name);
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
    if (tag !== "latest" && versions.length > 0) {
      checkTarget(pkg.version, tag, tagTarget(npm, pkg.name, tag));
    }
    for (const notice of notices) process.stderr.write(`::notice::${notice}\n`);
    process.stderr.write(`dist-tag: ${tag}\n`);
    process.stdout.write(tag);
  } catch (error) {
    process.stderr.write(`::error::${error.message}\n`);
    process.exit(1);
  }
}
