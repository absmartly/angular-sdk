import { describe, expect, it } from "@jest/globals";
import { execFileSync, spawnSync } from "child_process";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { distTag } = require("../scripts/npm-dist-tag.cjs") as {
  distTag: (version: string, latest?: string) => string;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validRange } = require("semver") as {
  validRange: (range: string) => string | null;
};

const SCRIPT = path.join(__dirname, "..", "scripts", "npm-dist-tag.cjs");

describe("npm dist-tag for the publish workflow", () => {
  it.each([
    // first publish: nothing on npm yet
    ["1.0.0", undefined, "latest"],
    ["1.0.0", "", "latest"],
    // newer than latest
    ["1.0.1", "1.0.0", "latest"],
    ["1.1.0", "1.0.9", "latest"],
    ["2.0.0", "1.9.9", "latest"],
    // republishing the latest version is left to npm to reject, not retagged
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
    ["9007199254740993.0.0", "9007199254740992.0.0", "latest"],
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

  describe("CLI", () => {
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

    it("prints nothing when the release becomes latest", () => {
      expect(run("1.0.0")).toBe("");
      expect(run("1.0.0", "")).toBe("");
      expect(run("2.0.0", "1.0.0")).toBe("");
    });

    it("prints the --tag argument otherwise", () => {
      expect(run("1.0.1", "2.0.0")).toBe("--tag latest-v1");
      expect(run("1.1.0-beta.1", "1.0.0")).toBe("--tag beta");
    });

    it("exits non-zero on an invalid version", () => {
      const result = spawnSync(process.execPath, [SCRIPT, "nope"], {
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("not a semver version");
    });
  });
});
