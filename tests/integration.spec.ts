import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSmartlyModule } from '../src/lib/absmartly.module';
import { provideABSmartly } from '../src/lib/absmartly.providers';
import { TreatmentComponent } from '../src/lib/treatment.component';
import { TreatmentVariantDirective } from '../src/lib/treatment-variant.directive';
import { TreatmentDirective } from '../src/lib/treatment.directive';
import type { ABSmartlyConfig } from '../src/lib/absmartly.types';

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    isReady: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
    isFinalized: jest.fn().mockReturnValue(false),
    ready: jest.fn().mockResolvedValue(undefined),
    treatment: jest.fn().mockReturnValue(1),
    peek: jest.fn().mockReturnValue(1),
    variableValue: jest.fn().mockReturnValue('hello'),
    peekVariableValue: jest.fn().mockReturnValue('hello'),
    variableKeys: jest.fn().mockReturnValue({ msg: ['exp1'] }),
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
    experiments: jest.fn().mockReturnValue(['my_exp']),
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

const testConfig: ABSmartlyConfig = {
  endpoint: 'http://test',
  apiKey: 'test-key',
  environment: 'test',
  application: 'test-app',
  units: { session_id: 'integration-user' },
};

@Component({
  template: `
    <abs-treatment name="my_exp">
      <ng-template absTreatmentVariant="0"><span class="control">Control</span></ng-template>
      <ng-template absTreatmentVariant="1"><span class="treatment">Treatment</span></ng-template>
    </abs-treatment>
    <div *absTreatment="'my_exp'; let v">
      <span class="directive-variant">{{ v }}</span>
    </div>
  `,
  standalone: true,
  imports: [TreatmentComponent, TreatmentVariantDirective, TreatmentDirective],
})
class IntegrationComponent {}

@Component({
  template: `<span class="svc-result">{{ variant }}</span>`,
  standalone: true,
})
class ServiceOnlyComponent {
  private abs = inject(ABSmartlyService);
  variant = this.abs.treatment('my_exp');
}

describe('Integration', () => {
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

  it('should render treatment variant via standalone providers', () => {
    TestBed.configureTestingModule({
      imports: [IntegrationComponent],
      providers: [provideABSmartly(testConfig)],
    });

    const fixture = TestBed.createComponent(IntegrationComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.treatment')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.directive-variant').textContent).toBe('1');
  });

  it('should work with service injection directly', () => {
    TestBed.configureTestingModule({
      imports: [ServiceOnlyComponent],
      providers: [provideABSmartly(testConfig)],
    });

    const fixture = TestBed.createComponent(ServiceOnlyComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.svc-result').textContent).toBe('1');
  });

  it('should render control when treatment returns 0', () => {
    mockCtx.treatment.mockReturnValue(0);

    TestBed.configureTestingModule({
      imports: [IntegrationComponent],
      providers: [provideABSmartly(testConfig)],
    });

    const fixture = TestBed.createComponent(IntegrationComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.control')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.directive-variant').textContent).toBe('0');
  });

  it('should work with NgModule forRoot', () => {
    TestBed.configureTestingModule({
      imports: [ABSmartlyModule.forRoot(testConfig), IntegrationComponent],
    });

    const fixture = TestBed.createComponent(IntegrationComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.treatment')).toBeTruthy();
  });
});
