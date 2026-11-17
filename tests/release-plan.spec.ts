import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { distTag, plan } = require("../scripts/release-plan.cjs") as {
  distTag: (version: string, latest?: string, versions?: string[]) => string;
  plan: (input: {
    version: string;
    refType: string;
    refName: string;
    dryRun: boolean;
    latest: string;
    versions: string[];
  }) => { tag: string; notices: string[] };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validRange } = require("semver") as {
  validRange: (range: string) => string | null;
};

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "release-plan.cjs");
const PKG = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);

describe("package.json", () => {
  it("names the publishing repository, which npm provenance requires", () => {
    // npm rejects a --provenance publish whose repository.url does not match the
    // GitHub repository that built it.
    expect(PKG.repository).toEqual({
      type: "git",
      url: "git+https://github.com/absmartly/angular-sdk.git",
    });
  });
});

describe("distTag", () => {
  it.each([
    // first publish: nothing on npm yet
    ["1.0.0", undefined, "latest"],
    ["1.0.0", "", "latest"],
    // newer than latest
    ["1.0.1", "1.0.0", "latest"],
    ["1.1.0", "1.0.9", "latest"],
    ["2.0.0", "1.9.9", "latest"],
    // republishing the latest version is caught by plan(), not retagged
    ["1.0.0", "1.0.0", "latest"],
    // a stable release outranks a prerelease latest of the same core
    ["2.0.0", "2.0.0-beta.1", "latest"],
    // lower major than latest: never becomes latest
    ["1.0.1", "2.0.0", "latest-v1"],
    ["1.99.99", "2.0.0", "latest-v1"],
    ["0.9.0", "1.0.0", "latest-v0"],
    // numeric, not lexical, comparison
    ["1.10.0", "1.9.0", "latest"],
    ["0.10.0", "1.0.0", "latest-v0"],
    ["10.0.0", "9.0.0", "latest"],
    // beyond Number.MAX_SAFE_INTEGER, in both directions
    ["9007199254740993.0.0", "9007199254740992.0.0", "latest"],
    [
      "9007199254740992.0.0",
      "9007199254740993.0.0",
      "latest-v9007199254740992",
    ],
    // build metadata is ignored
    ["1.0.1+build.5", "1.0.0", "latest"],
    // prereleases never become latest
    ["1.1.0-beta.1", "1.0.0", "beta"],
    ["1.1.0-alpha", undefined, "alpha"],
    ["2.0.0-rc.2", "1.0.0", "rc"],
    ["2.0.0-next.0", "1.0.0", "next"],
    ["2.0.0-0", "1.0.0", "next"],
    // ...even below latest, since they never move it
    ["1.0.0-beta.1", "1.0.0", "beta"],
  ])("%s with latest %s -> %s", (version, latest, expected) => {
    expect(distTag(version, latest)).toBe(expected);
  });

  it.each([
    "",
    "v1.0.0",
    "1.0",
    "1.0.0.0",
    "01.0.0",
    "1.0.0-",
    " 1.0.0",
    "1.0.0\n--tag latest",
  ])("rejects invalid version %j", (version) => {
    expect(() => distTag(version, "1.0.0")).toThrow("not a semver version");
  });

  it.each([
    ["1.4.1", "1.5.0"],
    ["1.5.0", "1.5.1"],
    ["1.9.0", "1.10.0"],
  ])("refuses %s below latest %s in the same major", (version, latest) => {
    expect(() => distTag(version, latest)).toThrow(
      "refusing to move latest backwards",
    );
  });

  it.each([
    // a newer stable 1.x is already out: latest-v1 would move backwards
    ["1.5.0", "2.0.0", ["1.6.0", "2.0.0"], "1.6.0"],
    ["1.5.0", "2.0.0", ["1.5.1", "2.0.0"], "1.5.1"],
    ["1.9.0", "2.0.0", ["1.10.0", "2.0.0"], "1.10.0"],
  ])(
    "refuses %s with latest %s when %j has the newer %s in its major",
    (version, latest, versions, newer) => {
      expect(() => distTag(version, latest, versions)).toThrow(
        `lower than ${newer}, already published in major 1: refusing to move latest-v1 backwards`,
      );
    },
  );

  it.each([
    // older 1.x, other majors and 1.x prereleases do not block a 1.x backport
    [
      "1.5.0",
      "2.0.0",
      ["1.4.0", "1.5.0-beta.1", "1.6.0-rc.1", "2.0.0", "3.0.0-0"],
    ],
    ["1.5.0", "2.0.0", ["0.9.0", "11.0.0", "2.0.0"]],
    ["1.5.0", "2.0.0", []],
    // the version itself is not "newer" (republishing is refused by plan())
    ["1.5.0", "2.0.0", ["1.5.0", "2.0.0"]],
  ])(
    "publishes %s with latest %s under latest-v1 given %j",
    (version, latest, versions) => {
      expect(distTag(version, latest, versions)).toBe("latest-v1");
    },
  );

  it.each([
    ["1.0.1", "2.0.0"],
    ["0.9.0", "1.0.0"],
    ["1.1.0-beta.1", "1.0.0"],
    ["2.0.0-0", "1.0.0"],
  ])(
    "returns a dist-tag npm accepts for %s with latest %s",
    (version, latest) => {
      // npm publish refuses a --tag that is a valid semver range ("v1", "1", "1.x").
      const tag = distTag(version, latest);
      expect(tag).not.toBe("latest");
      expect(validRange(tag)).toBeNull();
    },
  );

  it("rejects an invalid latest version", () => {
    expect(() => distTag("1.0.0", "garbage")).toThrow("not a semver version");
  });
});

describe("plan", () => {
  const base = {
    version: "1.2.3",
    refType: "tag",
    refName: "v1.2.3",
    dryRun: false,
    latest: "",
    versions: [] as string[],
  };

  it("accepts the tag equal to v<version>", () => {
    expect(plan(base)).toEqual({ tag: "latest", notices: [] });
  });

  it.each(["v1.2.4", "1.2.3", "v1.2.3-beta.1", "v1.2", "v1.2.3.0"])(
    "rejects tag %s for version 1.2.3",
    (refName) => {
      expect(() => plan({ ...base, refName })).toThrow(
        "does not match package.json version 1.2.3",
      );
      // a dry run on a mismatched tag fails too
      expect(() => plan({ ...base, refName, dryRun: true })).toThrow(
        "does not match",
      );
    },
  );

  it("refuses a real publish from a branch", () => {
    expect(() => plan({ ...base, refType: "branch", refName: "main" })).toThrow(
      "publishing requires a v* tag ref, got branch main",
    );
  });

  it("allows a dry run from a branch, with a notice", () => {
    expect(
      plan({ ...base, refType: "branch", refName: "main", dryRun: true }),
    ).toEqual({
      tag: "latest",
      notices: ["dry run on branch main: no tag to compare with v1.2.3"],
    });
  });

  it("refuses a version that is already published", () => {
    expect(() =>
      plan({ ...base, latest: "1.2.3", versions: ["1.2.2", "1.2.3"] }),
    ).toThrow("version 1.2.3 is already published on npm");
  });

  it("refuses an already published version on a dry run too", () => {
    // npm publish --dry-run fails on it as well
    expect(() =>
      plan({ ...base, dryRun: true, latest: "1.2.3", versions: ["1.2.3"] }),
    ).toThrow("version 1.2.3 is already published on npm");
  });

  it("refuses a backport below a newer release of its major", () => {
    expect(() =>
      plan({ ...base, latest: "2.0.0", versions: ["1.3.0", "2.0.0"] }),
    ).toThrow("refusing to move latest-v1 backwards");
  });

  it("picks the dist-tag from the latest version on npm", () => {
    expect(plan({ ...base, latest: "2.0.0", versions: ["2.0.0"] }).tag).toBe(
      "latest-v1",
    );
  });
});

describe("CLI", () => {
  // The CLI runs from a scratch directory with its own package.json, so these
  // cases do not depend on the repository's current version (a prerelease
  // version would otherwise change every expected dist-tag).
  const NAME = "@absmartly/angular-sdk";
  let dir: string;
  let fakeNpm: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-plan-"));
    fakeNpm = path.join(dir, "npm");
    // Answers `npm view <pkg> versions --json` and `npm view <pkg> dist-tags.latest`
    // like the real npm 11/12 CLI, from FAKE_* variables.
    fs.writeFileSync(
      fakeNpm,
      `#!/usr/bin/env node
const args = process.argv.slice(2);
const fs = require("fs");
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(args) + "\\n");
if (process.env.FAKE_ERROR) {
  process.stderr.write(process.env.FAKE_ERROR);
  process.exit(1);
}
if (args[2] === "versions") process.stdout.write(process.env.FAKE_VERSIONS + "\\n");
else if (args[2] === "dist-tags.latest") process.stdout.write(process.env.FAKE_LATEST + "\\n");
else process.exit(2);
`,
    );
    fs.chmodSync(fakeNpm, 0o755);
  });

  function writePackage(version: string) {
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: NAME, version }),
    );
  }

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  function run(env: Record<string, string>, version = "1.2.3") {
    writePackage(version);
    const log = path.join(dir, `log-${Math.random()}`);
    fs.writeFileSync(log, "");
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NPM_BIN: fakeNpm,
        FAKE_LOG: log,
        REF_TYPE: "tag",
        REF_NAME: `v${version}`,
        DRY_RUN: "false",
        ...env,
      },
    });
    const calls = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return { ...result, calls };
  }

  const E404 =
    "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@absmartly%2fangular-sdk - Not found\n";

  it("publishes as latest when the package was never published (E404)", () => {
    const result = run({ FAKE_ERROR: E404 });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("latest");
    expect(result.stderr).toContain("latest on npm: <none>");
    expect(result.calls).toEqual([
      ["view", "@absmartly/angular-sdk", "versions", "--json"],
    ]);
  });

  it("fails on any npm view error other than E404", () => {
    const result = run({
      FAKE_ERROR: "npm error code ETIMEDOUT\nnpm error network timeout\n",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("ETIMEDOUT");
  });

  it("publishes under latest-v<major> when latest has a higher major", () => {
    const result = run({
      FAKE_VERSIONS: JSON.stringify(["1.2.2", "2.0.0"]),
      FAKE_LATEST: "2.0.0",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("latest-v1");
    expect(result.calls).toEqual([
      ["view", "@absmartly/angular-sdk", "versions", "--json"],
      ["view", "@absmartly/angular-sdk", "dist-tags.latest"],
    ]);
  });

  it("reads a single published version, which npm prints as a string", () => {
    const result = run({
      FAKE_VERSIONS: JSON.stringify("1.2.3"),
      FAKE_LATEST: "1.2.3",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "::error::version 1.2.3 is already published on npm",
    );
  });

  it("compares a single published version exactly, not as a substring", () => {
    // "11.2.3" contains "1.2.3": a string match would call it already published.
    const result = run({
      FAKE_VERSIONS: JSON.stringify("11.2.3"),
      FAKE_LATEST: "11.2.3",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("latest-v1");
  });

  it.each([
    ["1.3.0-beta.1", "beta"],
    ["1.3.0-rc.0", "rc"],
    ["2.0.0-0", "next"],
  ])("publishes prerelease %s under %s", (version, tag) => {
    const result = run(
      { FAKE_VERSIONS: '["1.2.3"]', FAKE_LATEST: "1.2.3" },
      version,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(tag);
  });

  it("refuses a tag that does not match package.json", () => {
    const result = run({ REF_NAME: "v0.0.0-nope", FAKE_ERROR: E404 });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("::error::tag v0.0.0-nope does not match");
  });

  it("allows a dry run from a branch", () => {
    const result = run({
      REF_TYPE: "branch",
      REF_NAME: "main",
      DRY_RUN: "true",
      FAKE_ERROR: E404,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("::notice::dry run on branch main");
  });

  it("refuses a real publish from a branch", () => {
    const result = run({
      REF_TYPE: "branch",
      REF_NAME: "main",
      FAKE_ERROR: E404,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("publishing requires a v* tag ref");
  });
});
