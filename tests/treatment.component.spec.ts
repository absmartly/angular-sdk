import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TreatmentComponent } from '../src/lib/treatment.component';
import { TreatmentVariantDirective } from '../src/lib/treatment-variant.directive';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSMARTLY_CONFIG } from '../src/lib/absmartly.types';
import type { ABSmartlyConfig } from '../src/lib/absmartly.types';

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    isReady: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
    isFinalized: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue(undefined),
    treatment: jest.fn().mockReturnValue(0),
    peek: jest.fn().mockReturnValue(0),
    variableValue: jest.fn().mockReturnValue(''),
    peekVariableValue: jest.fn().mockReturnValue(''),
    variableKeys: jest.fn().mockReturnValue({}),
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
    <abs-treatment name="test_exp">
      <ng-template absTreatmentVariant="0"><span class="v0">Control</span></ng-template>
      <ng-template absTreatmentVariant="1"><span class="v1">Treatment B</span></ng-template>
      <ng-template absTreatmentVariant="2"><span class="v2">Treatment C</span></ng-template>
    </abs-treatment>
  `,
  standalone: true,
  imports: [TreatmentComponent, TreatmentVariantDirective],
})
class TestHostComponent {}

@Component({
  template: `
    <abs-treatment name="test_exp">
      <ng-template absTreatmentVariant="0"><span class="v0">Control</span></ng-template>
      <ng-template absTreatmentVariant="default"><span class="default">Default</span></ng-template>
    </abs-treatment>
  `,
  standalone: true,
  imports: [TreatmentComponent, TreatmentVariantDirective],
})
class TestHostWithDefaultComponent {}

@Component({
  template: `
    <abs-treatment name="test_exp" [peek]="true">
      <ng-template absTreatmentVariant="0"><span class="v0">Control</span></ng-template>
      <ng-template absTreatmentVariant="1"><span class="v1">Treatment</span></ng-template>
    </abs-treatment>
  `,
  standalone: true,
  imports: [TreatmentComponent, TreatmentVariantDirective],
})
class TestHostPeekComponent {}

describe('TreatmentComponent', () => {
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

  it('should render variant 0 (control) by default', () => {
    mockCtx.treatment.mockReturnValue(0);
    const fixture = createFixture(TestHostComponent);
    expect(fixture.nativeElement.querySelector('.v0')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.v0').textContent).toBe('Control');
  });

  it('should render variant 1 when treatment returns 1', () => {
    mockCtx.treatment.mockReturnValue(1);
    const fixture = createFixture(TestHostComponent);
    expect(fixture.nativeElement.querySelector('.v1')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.v1').textContent).toBe('Treatment B');
  });

  it('should render variant 2 when treatment returns 2', () => {
    mockCtx.treatment.mockReturnValue(2);
    const fixture = createFixture(TestHostComponent);
    expect(fixture.nativeElement.querySelector('.v2')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.v2').textContent).toBe('Treatment C');
  });

  it('should call context.treatment() with experiment name', () => {
    createFixture(TestHostComponent);
    expect(mockCtx.treatment).toHaveBeenCalledWith('test_exp');
  });

  it('should fallback to default variant when no match', () => {
    mockCtx.treatment.mockReturnValue(99);
    const fixture = createFixture(TestHostWithDefaultComponent);
    expect(fixture.nativeElement.querySelector('.default')).toBeTruthy();
  });

  it('should use peek when peek input is true', () => {
    mockCtx.peek.mockReturnValue(1);
    const fixture = createFixture(TestHostPeekComponent);
    expect(mockCtx.peek).toHaveBeenCalledWith('test_exp');
    expect(mockCtx.treatment).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.v1')).toBeTruthy();
  });

  it('should render first variant as fallback when no match and no default', () => {
    mockCtx.treatment.mockReturnValue(99);
    const fixture = createFixture(TestHostComponent);
    expect(fixture.nativeElement.querySelector('.v0')).toBeTruthy();
  });
});
