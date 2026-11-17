import { describe, expect, it } from "@jest/globals";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require("js-yaml") as { load: (text: string) => unknown };

type Step = {
  name: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};
type Workflow = {
  concurrency: { group: string; "cancel-in-progress": boolean };
  on: {
    push: { tags: string[]; branches?: string[] };
    workflow_dispatch: {
      inputs: { dry_run: { type: string; default: boolean } };
    };
  };
  jobs: {
    publish: {
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
    expect(plan.run).toContain("TAG_ARGS=$(node scripts/release-plan.cjs)");
    expect(plan.run).toContain('echo "args=${TAG_ARGS}" >> "$GITHUB_OUTPUT"');
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

  it("dry run: npm publish --dry-run, without the token", () => {
    const dry = step("Publish to npm (dry run)");
    expect(dry.if).toBe("env.DRY_RUN == 'true'");
    expect(dry.run).toBe(
      "npm publish --provenance --access public $TAG_ARGS --dry-run",
    );
    expect(dry.env).toEqual({ TAG_ARGS: "${{ steps.plan.outputs.args }}" });
  });

  it("real run: npm publish with provenance, dist-tag and the token fallback", () => {
    const publish = step("Publish to npm");
    expect(publish.if).toBe("env.DRY_RUN != 'true'");
    expect(publish.run).toBe(
      "npm publish --provenance --access public $TAG_ARGS",
    );
    expect(publish.env).toEqual({
      TAG_ARGS: "${{ steps.plan.outputs.args }}",
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
    });
  });

  it("never runs npm dist-tag", () => {
    for (const s of job.steps) expect(s.run ?? "").not.toMatch(/dist-tag\s/);
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
