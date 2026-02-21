import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TreatmentDirective } from '../src/lib/treatment.directive';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSMARTLY_CONFIG } from '../src/lib/absmartly.types';
import type { ABSmartlyConfig } from '../src/lib/absmartly.types';

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    isReady: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
    isFinalized: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue(undefined),
    treatment: jest.fn().mockReturnValue(1),
    peek: jest.fn().mockReturnValue(1),
    variableValue: jest.fn().mockReturnValue('banner-text'),
    peekVariableValue: jest.fn().mockReturnValue('banner-text'),
    variableKeys: jest.fn().mockReturnValue({ banner: ['exp1'] }),
    track: jest.fn(),
    attribute: jest.fn(),
    attributes: jest.fn(),
    getAttribute: jest.fn().mockReturnValue(undefined),
    override: jest.fn(),
    customAssignment: jest.fn(),
    customFieldValue: jest.fn().mockReturnValue(null),
    customFieldKeys: jest.fn().mockReturnValue([]),
    customFieldValueType: jest.fn().mockReturnValue(null),
    unit: jest.fn(),
    getUnit: jest.fn().mockReturnValue(''),
    publish: jest.fn().mockResolvedValue(undefined),
    finalize: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    pending: jest.fn().mockReturnValue(0),
    experiments: jest.fn().mockReturnValue([]),
    data: jest.fn().mockReturnValue({ experiments: [] }),
    _sdk: {},
    ...overrides,
  };
}

jest.mock('@absmartly/javascript-sdk', () => {
  class Context {}
  return {
    __esModule: true,
    default: { SDK: jest.fn(), Context },
    SDK: jest.fn(),
    Context,
  };
});

const defaultConfig: ABSmartlyConfig = {
  endpoint: 'http://test',
  apiKey: 'test-key',
  environment: 'test',
  application: 'test-app',
  units: { session_id: 'user-1' },
};

@Component({
  template: `
    <div *absTreatment="'test_exp'; let variant; let vars = variables; let isLoading = loading">
      <span class="variant">{{ variant }}</span>
      <span class="loading">{{ isLoading }}</span>
      <span class="banner">{{ vars['banner'] }}</span>
    </div>
  `,
  standalone: true,
  imports: [TreatmentDirective],
})
class TestHostDirectiveComponent {}

@Component({
  template: `
    <div *absTreatment="'test_exp'; let v">
      <span class="variant">{{ v }}</span>
    </div>
  `,
  standalone: true,
  imports: [TreatmentDirective],
})
class TestHostImplicitComponent {}

describe('TreatmentDirective', () => {
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

  function createFixture(component: any): ComponentFixture<any> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        { provide: ABSMARTLY_CONFIG, useValue: defaultConfig },
        ABSmartlyService,
      ],
    });

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture;
  }

  it('should render with variant from treatment', () => {
    mockCtx.treatment.mockReturnValue(1);
    const fixture = createFixture(TestHostDirectiveComponent);
    expect(fixture.nativeElement.querySelector('.variant').textContent).toBe('1');
  });

  it('should render with variant 0 for control', () => {
    mockCtx.treatment.mockReturnValue(0);
    const fixture = createFixture(TestHostDirectiveComponent);
    expect(fixture.nativeElement.querySelector('.variant').textContent).toBe('0');
  });

  it('should render loading as false when context is ready', () => {
    const fixture = createFixture(TestHostDirectiveComponent);
    expect(fixture.nativeElement.querySelector('.loading').textContent).toBe('false');
  });

  it('should render variables from context', () => {
    const fixture = createFixture(TestHostDirectiveComponent);
    expect(fixture.nativeElement.querySelector('.banner').textContent).toBe('banner-text');
  });

  it('should provide implicit template variable', () => {
    mockCtx.treatment.mockReturnValue(2);
    const fixture = createFixture(TestHostImplicitComponent);
    expect(fixture.nativeElement.querySelector('.variant').textContent).toBe('2');
  });

  it('should call treatment with experiment name', () => {
    createFixture(TestHostDirectiveComponent);
    expect(mockCtx.treatment).toHaveBeenCalledWith('test_exp');
  });

  it('should call peekVariableValue for variables', () => {
    createFixture(TestHostDirectiveComponent);
    expect(mockCtx.peekVariableValue).toHaveBeenCalledWith('banner', '');
  });
});
