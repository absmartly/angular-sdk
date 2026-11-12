import { TestBed } from "@angular/core/testing";
import absmartly from "@absmartly/javascript-sdk";
import { ABSmartlyService } from "../src/lib/absmartly.service";
import { ABSMARTLY_CONFIG } from "../src/lib/absmartly.types";

// javascript-sdk 1.14.0 evaluates audiences with the configured application
// and environment names, so a strict audience on either one matches without
// the caller setting it as an attribute.
const strictAudienceData = (filter: unknown[]) => ({
  experiments: [
    {
      id: 1,
      name: "exp_test_ab",
      iteration: 1,
      unitType: "session_id",
      seedHi: 3603515,
      seedLo: 233373850,
      split: [0.0, 1.0],
      trafficSeedHi: 449867249,
      trafficSeedLo: 455443629,
      trafficSplit: [0.0, 1.0],
      fullOnVariant: 0,
      applications: [{ name: "website" }],
      variants: [
        { name: "A", config: null },
        { name: "B", config: '{"banner.size":"large"}' },
      ],
      audienceStrict: true,
      audience: JSON.stringify({ filter }),
      customFieldValues: null,
    },
  ],
});

const environmentIs = (value: string) => [
  { eq: [{ var: "environment" }, { value }] },
];
const applicationIs = (value: string) => [
  { eq: [{ var: "application" }, { value }] },
];

describe("ABSmartlyService system attributes in audiences", () => {
  let getContextData: jest.SpyInstance;
  let publish: jest.SpyInstance;

  const serviceWith = async (filter: unknown[], fullOnVariant = 0) => {
    const data = strictAudienceData(filter);
    data.experiments[0].fullOnVariant = fullOnVariant;
    getContextData.mockResolvedValue(data);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ABSMARTLY_CONFIG,
          useValue: {
            endpoint: "http://localhost",
            apiKey: "key",
            environment: "production",
            application: "website",
            units: { session_id: "e791e240fcd3df7d238cfc285f475e8152fcc0ec" },
          },
        },
        ABSmartlyService,
      ],
    });
    const svc = TestBed.inject(ABSmartlyService);
    await svc.getContext().ready();
    expect(svc.ready()).toBe(true);
    expect(svc.failed()).toBe(false);
    return svc;
  };

  beforeEach(() => {
    getContextData = jest.spyOn(
      absmartly.ContextDataProvider.prototype,
      "getContextData",
    );
    publish = jest
      .spyOn(absmartly.ContextPublisher.prototype, "publish")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    getContextData.mockRestore();
    publish.mockRestore();
  });

  it("gives the matching variant for a strict audience on the configured environment", async () => {
    const svc = await serviceWith(environmentIs("production"));
    expect(svc.treatment("exp_test_ab")).toBe(1);
    expect(svc.variableValue("banner.size", "default")).toBe("large");
  });

  it("gives the full-on variant for a strict environment audience", async () => {
    const svc = await serviceWith(environmentIs("production"), 1);
    expect(svc.treatment("exp_test_ab")).toBe(1);
  });

  it("gives the matching variant for a strict audience on the configured application", async () => {
    const svc = await serviceWith(applicationIs("website"));
    expect(svc.treatment("exp_test_ab")).toBe(1);
  });

  it("gives variant 0 for a strict audience on another environment", async () => {
    const svc = await serviceWith(environmentIs("staging"));
    expect(svc.treatment("exp_test_ab")).toBe(0);
    expect(svc.variableValue("banner.size", "default")).toBe("default");
  });

  it("lets a user-set environment override the configured one", async () => {
    const svc = await serviceWith(environmentIs("production"));
    svc.attribute("environment", "staging");
    expect(svc.treatment("exp_test_ab")).toBe(0);
  });
});
