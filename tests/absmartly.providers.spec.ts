import { TestBed } from '@angular/core/testing';
import { provideABSmartly } from '../src/lib/absmartly.providers';
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

describe('provideABSmartly', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should provide ABSmartlyService', () => {
    TestBed.configureTestingModule({
      providers: [provideABSmartly(testConfig)],
    });

    const service = TestBed.inject(ABSmartlyService);
    expect(service).toBeInstanceOf(ABSmartlyService);
  });

  it('should provide ABSMARTLY_CONFIG', () => {
    TestBed.configureTestingModule({
      providers: [provideABSmartly(testConfig)],
    });

    const config = TestBed.inject(ABSMARTLY_CONFIG);
    expect(config).toEqual(testConfig);
  });

  it('should use config values', () => {
    TestBed.configureTestingModule({
      providers: [provideABSmartly(testConfig)],
    });

    const config = TestBed.inject(ABSMARTLY_CONFIG);
    expect(config.endpoint).toBe('http://test');
    expect(config.apiKey).toBe('test-key');
    expect(config.environment).toBe('test');
    expect(config.application).toBe('test-app');
    expect(config.units).toEqual({ session_id: 'user-1' });
  });

  it('should provide same service instance (singleton)', () => {
    TestBed.configureTestingModule({
      providers: [provideABSmartly(testConfig)],
    });

    const service1 = TestBed.inject(ABSmartlyService);
    const service2 = TestBed.inject(ABSmartlyService);
    expect(service1).toBe(service2);
  });
});
