import { TestBed } from '@angular/core/testing';
import { ABSmartlyModule } from '../src/lib/absmartly.module';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSMARTLY_CONFIG } from '../src/lib/absmartly.types';
import type { ABSmartlyConfig } from '../src/lib/absmartly.types';

jest.mock('@absmartly/javascript-sdk', () => {
  const mCtx = {
    isReady: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
    isFinalized: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue(undefined),
    treatment: jest.fn().mockReturnValue(0),
    peek: jest.fn().mockReturnValue(0),
    finalize: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    _sdk: {},
  };
  const mSDK = {
    createContext: jest.fn().mockReturnValue(mCtx),
    createContextWith: jest.fn().mockReturnValue(mCtx),
  };
  class Context {}
  return {
    __esModule: true,
    default: { SDK: jest.fn().mockImplementation(() => mSDK) },
    SDK: jest.fn().mockImplementation(() => mSDK),
    Context,
  };
});

const testConfig: ABSmartlyConfig = {
  endpoint: 'http://test',
  apiKey: 'test-key',
  environment: 'test',
  application: 'test-app',
  units: { session_id: 'user-1' },
};

describe('ABSmartlyModule', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should provide ABSmartlyService via forRoot()', () => {
    TestBed.configureTestingModule({
      imports: [ABSmartlyModule.forRoot(testConfig)],
    });

    const service = TestBed.inject(ABSmartlyService);
    expect(service).toBeInstanceOf(ABSmartlyService);
  });

  it('should provide ABSMARTLY_CONFIG via forRoot()', () => {
    TestBed.configureTestingModule({
      imports: [ABSmartlyModule.forRoot(testConfig)],
    });

    const config = TestBed.inject(ABSMARTLY_CONFIG);
    expect(config).toEqual(testConfig);
  });

  it('should return ModuleWithProviders with correct ngModule', () => {
    const result = ABSmartlyModule.forRoot(testConfig);
    expect(result.ngModule).toBe(ABSmartlyModule);
    expect(result.providers).toBeDefined();
    expect(result.providers!.length).toBeGreaterThan(0);
  });
});
