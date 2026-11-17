import { describe, expect, it } from "@jest/globals";
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

  it("checks tag, version and dist-tag before publishing", () => {
    const names = job.steps.map((s) => s.name);
    const plan = step("Check tag, version and npm dist-tag");
    expect(plan.run).toContain("TAG_ARGS=$(node scripts/release-plan.cjs)");
    expect(plan.env).toEqual({
      REF_TYPE: "${{ github.ref_type }}",
      REF_NAME: "${{ github.ref_name }}",
    });
    for (const before of [
      "Upgrade npm for trusted publishing",
      "Install dependencies",
      "Test",
      "Build",
    ]) {
      expect(names.indexOf(before)).toBeLessThan(names.indexOf(plan.name));
    }
    expect(names.indexOf(plan.name)).toBeLessThan(
      names.indexOf("Publish to npm"),
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

  it("requires npm >= 11.5.1 on Node 22+", () => {
    expect(
      Number(step("Setup Node.js").with?.["node-version"]),
    ).toBeGreaterThanOrEqual(22);
    const upgrade = step("Upgrade npm for trusted publishing").run ?? "";
    expect(upgrade).toContain("npm install -g npm@latest");
    expect(upgrade).toContain("11.5.1");
  });
});
