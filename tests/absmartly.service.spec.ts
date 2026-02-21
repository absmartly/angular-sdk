import { TestBed } from '@angular/core/testing';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSMARTLY_CONFIG, ABSMARTLY_CONTEXT } from '../src/lib/absmartly.types';
import type { ABSmartlyConfig } from '../src/lib/absmartly.types';

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    isReady: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
    isFinalized: jest.fn().mockReturnValue(false),
    isFinalizing: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue(undefined),
    treatment: jest.fn().mockReturnValue(1),
    peek: jest.fn().mockReturnValue(1),
    variableValue: jest.fn().mockReturnValue('test-value'),
    peekVariableValue: jest.fn().mockReturnValue('peek-value'),
    variableKeys: jest.fn().mockReturnValue({ key1: ['exp1'] }),
    track: jest.fn(),
    attribute: jest.fn(),
    attributes: jest.fn(),
    getAttribute: jest.fn().mockReturnValue(undefined),
    override: jest.fn(),
    customAssignment: jest.fn(),
    customFieldValue: jest.fn().mockReturnValue('field-value'),
    customFieldKeys: jest.fn().mockReturnValue(['field1', 'field2']),
    customFieldValueType: jest.fn().mockReturnValue('string'),
    unit: jest.fn(),
    getUnit: jest.fn().mockReturnValue('user-123'),
    publish: jest.fn().mockResolvedValue(undefined),
    finalize: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    pending: jest.fn().mockReturnValue(0),
    experiments: jest.fn().mockReturnValue(['exp_test_ab']),
    data: jest.fn().mockReturnValue({ experiments: [] }),
    _sdk: {},
    ...overrides,
  };
}

jest.mock('@absmartly/javascript-sdk', () => {
  class Context {}
  return {
    __esModule: true,
    default: {
      SDK: jest.fn(),
      Context,
    },
    SDK: jest.fn(),
    Context,
  };
});

const defaultConfig: ABSmartlyConfig = {
  endpoint: 'http://test-endpoint',
  apiKey: 'test-api-key',
  environment: 'test',
  application: 'test-app',
  units: { session_id: 'test-session' },
};

describe('ABSmartlyService', () => {
  let mockCtx: any;
  let mockSDK: any;

  beforeEach(() => {
    mockCtx = createMockContext();
    mockSDK = {
      createContext: jest.fn().mockReturnValue(mockCtx),
      createContextWith: jest.fn().mockReturnValue(mockCtx),
    };

    const absmartly = require('@absmartly/javascript-sdk').default;
    absmartly.SDK.mockImplementation(() => mockSDK);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
  });

  describe('with config (no existing context)', () => {
    let service: ABSmartlyService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: ABSMARTLY_CONFIG, useValue: defaultConfig },
          ABSmartlyService,
        ],
      });
      service = TestBed.inject(ABSmartlyService);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should set ready signal when context is ready', () => {
      expect(service.ready()).toBe(true);
    });

    it('should set loading to false when context is ready', () => {
      expect(service.loading()).toBe(false);
    });

    it('should have no error when context is ready', () => {
      expect(service.error()).toBeNull();
    });

    it('should delegate treatment() to context', () => {
      const result = service.treatment('exp_test');
      expect(result).toBe(1);
      expect(mockCtx.treatment).toHaveBeenCalledWith('exp_test');
    });

    it('should delegate peek() to context', () => {
      const result = service.peek('exp_test');
      expect(result).toBe(1);
      expect(mockCtx.peek).toHaveBeenCalledWith('exp_test');
    });

    it('should delegate variableValue() to context', () => {
      const result = service.variableValue('key1', 'default');
      expect(result).toBe('test-value');
      expect(mockCtx.variableValue).toHaveBeenCalledWith('key1', 'default');
    });

    it('should delegate peekVariableValue() to context', () => {
      const result = service.peekVariableValue('key1', 'default');
      expect(result).toBe('peek-value');
      expect(mockCtx.peekVariableValue).toHaveBeenCalledWith('key1', 'default');
    });

    it('should delegate variableKeys() to context', () => {
      const result = service.variableKeys();
      expect(result).toEqual({ key1: ['exp1'] });
    });

    it('should delegate track() to context with properties', () => {
      service.track('purchase', { amount: 99.99 });
      expect(mockCtx.track).toHaveBeenCalledWith('purchase', { amount: 99.99 });
    });

    it('should delegate track() to context without properties', () => {
      service.track('pageview');
      expect(mockCtx.track).toHaveBeenCalledWith('pageview', undefined);
    });

    it('should delegate attribute() to context', () => {
      service.attribute('age', 25);
      expect(mockCtx.attribute).toHaveBeenCalledWith('age', 25);
    });

    it('should delegate attributes() to context', () => {
      service.attributes({ age: 25, name: 'test' });
      expect(mockCtx.attributes).toHaveBeenCalledWith({ age: 25, name: 'test' });
    });

    it('should delegate getAttribute() to context', () => {
      const result = service.getAttribute('age');
      expect(result).toBeUndefined();
    });

    it('should delegate override() to context', () => {
      service.override('exp_test', 2);
      expect(mockCtx.override).toHaveBeenCalledWith('exp_test', 2);
    });

    it('should delegate customAssignment() to context', () => {
      service.customAssignment('exp_test', 3);
      expect(mockCtx.customAssignment).toHaveBeenCalledWith('exp_test', 3);
    });

    it('should delegate customFieldValue() to context', () => {
      const result = service.customFieldValue('exp_test', 'field1');
      expect(result).toBe('field-value');
    });

    it('should delegate customFieldKeys() to context', () => {
      const result = service.customFieldKeys();
      expect(result).toEqual(['field1', 'field2']);
    });

    it('should delegate customFieldValueType() to context', () => {
      const result = service.customFieldValueType('exp_test', 'field1');
      expect(result).toBe('string');
    });

    it('should delegate setUnit() to context.unit()', () => {
      service.setUnit('user_id', 'abc-123');
      expect(mockCtx.unit).toHaveBeenCalledWith('user_id', 'abc-123');
    });

    it('should delegate getUnit() to context', () => {
      const result = service.getUnit('session_id');
      expect(result).toBe('user-123');
    });

    it('should delegate publish() to context', async () => {
      await service.publish();
      expect(mockCtx.publish).toHaveBeenCalled();
    });

    it('should delegate finalize() to context', async () => {
      await service.finalize();
      expect(mockCtx.finalize).toHaveBeenCalled();
    });

    it('should delegate refresh() to context', async () => {
      await service.refresh();
      expect(mockCtx.refresh).toHaveBeenCalled();
    });

    it('should delegate isReady() to context', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should delegate isFailed() to context', () => {
      expect(service.isFailed()).toBe(false);
    });

    it('should delegate isFinalized() to context', () => {
      expect(service.isFinalized()).toBe(false);
    });

    it('should delegate pending() to context', () => {
      expect(service.pending()).toBe(0);
    });

    it('should delegate experiments() to context', () => {
      expect(service.experiments()).toEqual(['exp_test_ab']);
    });

    it('should delegate data() to context', () => {
      expect(service.data()).toEqual({ experiments: [] });
    });

    it('should expose getContext()', () => {
      expect(service.getContext()).toBeTruthy();
    });

    it('should expose getSDK()', () => {
      expect(service.getSDK()).toBeTruthy();
    });

    it('should finalize on destroy if not already finalized', () => {
      mockCtx.isFinalized.mockReturnValue(false);
      mockCtx.finalize.mockClear();
      service.ngOnDestroy();
      expect(mockCtx.finalize).toHaveBeenCalled();
    });

    it('should not finalize on destroy if already finalized', () => {
      mockCtx.isFinalized.mockReturnValue(true);
      mockCtx.finalize.mockClear();
      service.ngOnDestroy();
      expect(mockCtx.finalize).not.toHaveBeenCalled();
    });
  });

  describe('with existing context', () => {
    it('should use provided context', () => {
      const existingCtx = createMockContext();

      TestBed.configureTestingModule({
        providers: [
          { provide: ABSMARTLY_CONFIG, useValue: defaultConfig },
          { provide: ABSMARTLY_CONTEXT, useValue: existingCtx },
          ABSmartlyService,
        ],
      });

      const svc = TestBed.inject(ABSmartlyService);
      expect(svc.getContext()).toBe(existingCtx);
      expect(svc.ready()).toBe(true);
    });
  });

  describe('with async context (not ready)', () => {
    it('should set loading true initially for unready context', () => {
      const asyncCtx = createMockContext({
        isReady: jest.fn().mockReturnValue(false),
        ready: jest.fn().mockReturnValue(new Promise<void>(() => {})),
      });

      TestBed.configureTestingModule({
        providers: [
          { provide: ABSMARTLY_CONFIG, useValue: defaultConfig },
          { provide: ABSMARTLY_CONTEXT, useValue: asyncCtx },
          ABSmartlyService,
        ],
      });

      const svc = TestBed.inject(ABSmartlyService);
      expect(svc.loading()).toBe(true);
      expect(svc.ready()).toBe(false);
    });
  });

  describe('with failed context', () => {
    it('should set error signal when context fails', async () => {
      const testError = new Error('Connection failed');
      const failCtx = createMockContext({
        isReady: jest.fn().mockReturnValue(false),
        ready: jest.fn().mockRejectedValue(testError),
      });

      TestBed.configureTestingModule({
        providers: [
          { provide: ABSMARTLY_CONFIG, useValue: defaultConfig },
          { provide: ABSMARTLY_CONTEXT, useValue: failCtx },
          ABSmartlyService,
        ],
      });

      TestBed.inject(ABSmartlyService);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const svc = TestBed.inject(ABSmartlyService);
      expect(svc.error()).toEqual(testError);
      expect(svc.failed()).toBe(true);
      expect(svc.loading()).toBe(false);
    });
  });
});
