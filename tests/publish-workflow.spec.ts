import { describe, expect, it } from "@jest/globals";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require("js-yaml") as { load: (text: string) => unknown };

type Step = {
  name: string;
  id?: string;
  if?: string;
  "continue-on-error"?: boolean | string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};
type Workflow = {
  concurrency: {
    group: string;
    "cancel-in-progress": boolean;
    queue?: string;
  };
  on: {
    push: { tags: string[]; branches?: string[] };
    workflow_dispatch: {
      inputs: { dry_run: { type: string; default: boolean } };
    };
  };
  jobs: {
    publish: {
      if?: string;
      "continue-on-error"?: boolean | string;
      environment: string;
      permissions: Record<string, string>;
      env: Record<string, string>;
      steps: Step[];
    };
  };
};

// The workflow wiring that the release-plan tests cannot see: a dropped flag or a
// wrong `if:` here would publish a dry run, or publish without provenance.
const workflow = yaml.load(
  fs.readFileSync(
    path.join(__dirname, "..", ".github", "workflows", "publish.yml"),
    "utf8",
  ),
) as Workflow;
const job = workflow.jobs.publish;
const step = (name: string) => {
  const found = job.steps.find((s) => s.name === name);
  if (!found) throw new Error(`no step named ${name}`);
  return found;
};

describe("publish.yml", () => {
  it("runs on v* tags and on manual dispatch with dry_run on by default", () => {
    expect(workflow.on.push).toEqual({ tags: ["v*"] });
    expect(workflow.on.workflow_dispatch.inputs.dry_run).toMatchObject({
      type: "boolean",
      default: true,
    });
  });

  it("uses the npm environment with OIDC and read-only contents", () => {
    expect(job.environment).toBe("npm");
    expect(job.permissions).toEqual({
      "id-token": "write",
      contents: "read",
    });
  });

  it("is a dry run only for a manual dispatch with dry_run", () => {
    expect(job.env.DRY_RUN).toBe(
      "${{ github.event_name == 'workflow_dispatch' && inputs.dry_run }}",
    );
  });

  it("never cancels a running publish", () => {
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("runs one release at a time for the whole package, queueing the rest", () => {
    // Per-tag groups let 1.1.0 and 2.0.0 both plan "latest" in parallel; the
    // default queue (single) would drop a waiting release when a third arrives.
    expect(workflow.concurrency.group).toBe("publish-npm");
    expect(workflow.concurrency.queue).toBe("max");
  });

  it("installs, checks, tests and builds before the release checks", () => {
    const names = job.steps.map((s) => s.name);
    const required: [string, string][] = [
      ["Install dependencies", "npm ci --ignore-scripts"],
      ["Check formatting", "npm run check-format"],
      ["Test", "npm test"],
      ["Build", "npm run build"],
    ];
    const planIndex = names.indexOf("Check tag, version and npm dist-tag");
    expect(planIndex).toBeGreaterThan(
      names.indexOf("Upgrade npm for trusted publishing"),
    );
    for (const [name, run] of required) {
      expect(step(name).run).toBe(run);
      expect(names.indexOf(name)).toBeLessThan(planIndex);
    }
    expect(names.indexOf("Upgrade npm for trusted publishing")).toBeLessThan(
      names.indexOf("Install dependencies"),
    );
  });

  it("checks tag, version and dist-tag before publishing", () => {
    const names = job.steps.map((s) => s.name);
    const plan = step("Check tag, version and npm dist-tag");
    expect(plan.run).toContain("DIST_TAG=$(node scripts/release-plan.cjs)");
    expect(plan.run).toContain(
      'echo "dist-tag=${DIST_TAG}" >> "$GITHUB_OUTPUT"',
    );
    expect(plan.env).toEqual({
      REF_TYPE: "${{ github.ref_type }}",
      REF_NAME: "${{ github.ref_name }}",
    });
    expect(names.indexOf(plan.name)).toBeLessThan(
      names.indexOf("Publish to npm (dry run)"),
    );
    expect(names.indexOf(plan.name)).toBeLessThan(
      names.indexOf("Publish to npm"),
    );
  });

  it("writes the .npmrc that reads NODE_AUTH_TOKEN", () => {
    // setup-node only writes it when registry-url is set; without it the token
    // fallback has nothing to read NODE_AUTH_TOKEN and the publish fails.
    expect(step("Setup Node.js").with?.["registry-url"]).toBe(
      "https://registry.npmjs.org",
    );
  });

  it("feeds the release check's output to both publish steps", () => {
    // A lost or renamed id leaves DIST_TAG empty, and npm publish then fails
    // (or, without --tag, would make a 1.x patch latest).
    const id = step("Check tag, version and npm dist-tag").id;
    expect(id).toBe("plan");
    for (const name of ["Publish to npm (dry run)", "Publish to npm"]) {
      expect(step(name).env?.DIST_TAG).toBe(
        `\${{ steps.${id}.outputs.dist-tag }}`,
      );
    }
  });

  it("does not leave the GitHub token in the checkout", () => {
    expect(step("Checkout code").with?.["persist-credentials"]).toBe(false);
  });

  it("dry run: npm publish --dry-run, without the token", () => {
    const dry = step("Publish to npm (dry run)");
    expect(dry.if).toBe("env.DRY_RUN == 'true'");
    expect(dry.run).toBe(
      'npm publish --provenance --access public --tag "$DIST_TAG" --dry-run',
    );
    expect(dry.env).toEqual({
      DIST_TAG: "${{ steps.plan.outputs.dist-tag }}",
    });
  });

  it("real run: npm publish with provenance, dist-tag and the token fallback", () => {
    const publish = step("Publish to npm");
    expect(publish.if).toBe("env.DRY_RUN != 'true'");
    expect(publish.run).toBe(
      'npm publish --provenance --access public --tag "$DIST_TAG"',
    );
    expect(publish.env).toEqual({
      DIST_TAG: "${{ steps.plan.outputs.dist-tag }}",
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
    });
  });

  it("never runs npm dist-tag", () => {
    for (const s of job.steps) {
      expect(s.run ?? "").not.toMatch(/\bnpm\s+dist-tags?\b/);
    }
  });

  it("exposes NPM_TOKEN to the real publish step only", () => {
    // Not to the dry run, and not to npm ci or the tests, which run third-party
    // code. Checked on the parsed workflow, so a secret anywhere else (workflow
    // or job env, another step's env or with) is found.
    const uses: string[] = [];
    const walk = (node: unknown, where: string) => {
      if (typeof node === "string") {
        if (/\bsecrets\b/.test(node)) uses.push(`${where}: ${node}`);
      } else if (Array.isArray(node)) {
        node.forEach((item, i) =>
          walk(item, `${where}[${(item as Step)?.name ?? i}]`),
        );
      } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          walk(value, `${where}.${key}`);
        }
      }
    };
    walk(workflow, "workflow");
    expect(uses).toEqual([
      "workflow.jobs.publish.steps[Publish to npm].env.NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
    ]);
  });

  it("uses no dependency cache in the release job", () => {
    // A cache written by another workflow run must not feed a published artifact.
    for (const s of job.steps) {
      expect(Object.keys(s.with ?? {})).not.toContain("cache");
      expect(s.uses ?? "").not.toMatch(/^actions\/cache\b/);
    }
  });

  it("runs every step on every run and fails on any step failure", () => {
    // Only the two publish steps are conditional (on DRY_RUN, checked above).
    // A skipped or fail-open step would publish an untested build, or drop the
    // npm upgrade and with it OIDC.
    expect(job.if).toBeUndefined();
    expect(job["continue-on-error"]).toBeUndefined();
    for (const s of job.steps) {
      expect(s["continue-on-error"]).toBeUndefined();
      if (
        s.name !== "Publish to npm" &&
        s.name !== "Publish to npm (dry run)"
      ) {
        expect({ step: s.name, if: s.if }).toEqual({
          step: s.name,
          if: undefined,
        });
      }
    }
  });

  it("requires Node 22+ and installs the latest npm", () => {
    expect(
      Number(step("Setup Node.js").with?.["node-version"]),
    ).toBeGreaterThanOrEqual(22);
    expect(step("Upgrade npm for trusted publishing").run).toContain(
      "npm install -g npm@latest",
    );
  });

  describe("npm version gate", () => {
    // Runs the step's own inline check, with `npm --version` faked.
    const script = step("Upgrade npm for trusted publishing").run ?? "";
    const check = /node -e '([\s\S]*?)' "\$NPM_VERSION"/.exec(script)?.[1];

    it("is present", () => {
      expect(check).toBeDefined();
    });

    it.each([
      ["11.5.1", 0],
      ["11.5.2", 0],
      ["11.6.0", 0],
      ["11.21.2", 0],
      ["12.0.0", 0],
      ["12.2.2", 0],
      ["11.5.0", 1],
      ["11.4.9", 1],
      ["10.99.99", 1],
      ["9.2.0", 1],
    ])("npm %s -> exit %d", (version, status) => {
      const result = spawnSync(process.execPath, ["-e", check ?? "", version], {
        encoding: "utf8",
      });
      expect(result.status).toBe(status);
      if (status) expect(result.stderr).toContain("older than 11.5.1");
    });
  });
});
