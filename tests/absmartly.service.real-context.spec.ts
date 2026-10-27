import { TestBed } from '@angular/core/testing';
import absmartly from '@absmartly/javascript-sdk';
import { ABSmartlyService } from '../src/lib/absmartly.service';
import { ABSMARTLY_CONFIG, ABSMARTLY_CONTEXT } from '../src/lib/absmartly.types';

describe('ABSmartlyService with a real injected SDK context', () => {
  it('keeps the owning SDK and its custom hooks after resetContext', async () => {
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const dataProvider = { getContextData: jest.fn().mockResolvedValue({ experiments: [] }) };
    const eventLogger = jest.fn();
    const sdk = new absmartly.SDK({
      endpoint: 'http://localhost',
      apiKey: 'key',
      environment: 'test',
      application: 'app',
      publisher,
      provider: dataProvider,
      eventLogger,
    } as any);
    const injected = sdk.createContextWith({ units: { session_id: 'a' } }, { experiments: [] });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ABSMARTLY_CONFIG,
          useValue: {
            endpoint: 'http://other',
            apiKey: 'other',
            environment: 'other',
            application: 'other',
            units: { session_id: 'a' },
          },
        },
        { provide: ABSMARTLY_CONTEXT, useValue: injected },
        ABSmartlyService,
      ],
    });

    const svc = TestBed.inject(ABSmartlyService);
    expect(svc.getSDK()).toBe(sdk);

    await svc.resetContext({ session_id: 'b' });

    const fresh = svc.getContext() as any;
    expect(fresh).not.toBe(injected);
    expect(svc.getSDK()).toBe(sdk);
    expect(fresh._publisher).toBe(publisher);
    expect(fresh._dataProvider).toBe(dataProvider);
    expect(fresh._eventLogger).toBe(eventLogger);
  });

  it('does not finalize an injected context when the injector is destroyed', () => {
    const sdk = new absmartly.SDK({
      endpoint: 'http://localhost', apiKey: 'key', environment: 'test', application: 'app',
      publisher: { publish: jest.fn().mockResolvedValue(undefined) },
    } as any);
    const injected = sdk.createContextWith({ units: { session_id: 'a' } }, { experiments: [] });
    TestBed.configureTestingModule({
      providers: [
        { provide: ABSMARTLY_CONFIG, useValue: { endpoint: 'x', apiKey: 'x', environment: 'x', application: 'x', units: {} } },
        { provide: ABSMARTLY_CONTEXT, useValue: injected },
        ABSmartlyService,
      ],
    });
    TestBed.inject(ABSmartlyService);
    TestBed.resetTestingModule();
    expect(injected.isFinalized()).toBe(false);
    expect(injected.isFinalizing()).toBe(false);
  });

  it('finalizes a context it created by resetContext when the injector is destroyed', async () => {
    const sdk = new absmartly.SDK({
      endpoint: 'http://localhost', apiKey: 'key', environment: 'test', application: 'app',
      publisher: { publish: jest.fn().mockResolvedValue(undefined) },
    } as any);
    const injected = sdk.createContextWith({ units: { session_id: 'a' } }, { experiments: [] });
    TestBed.configureTestingModule({
      providers: [
        { provide: ABSMARTLY_CONFIG, useValue: { endpoint: 'x', apiKey: 'x', environment: 'x', application: 'x', units: {} } },
        { provide: ABSMARTLY_CONTEXT, useValue: injected },
        ABSmartlyService,
      ],
    });
    const svc = TestBed.inject(ABSmartlyService);
    await svc.resetContext({ session_id: 'b' });
    const created = svc.getContext();
    TestBed.resetTestingModule();
    expect(created.isFinalizing() || created.isFinalized()).toBe(true);
  });
});
