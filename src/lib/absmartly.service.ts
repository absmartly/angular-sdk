import { Inject, Injectable, OnDestroy, Optional, signal } from '@angular/core';
import absmartly from '@absmartly/javascript-sdk';
import {
  ABSMARTLY_CONFIG,
  ABSMARTLY_CONTEXT,
  ABSmartlyConfig,
  ABSmartlyContextOptions,
} from './absmartly.types';

@Injectable()
export class ABSmartlyService implements OnDestroy {
  private sdk!: any;
  private context!: any;

  readonly ready = signal(false);
  readonly failed = signal(false);
  readonly loading = signal(true);
  readonly error = signal<Error | null>(null);

  constructor(
    @Inject(ABSMARTLY_CONFIG) private config: ABSmartlyConfig,
    @Optional() @Inject(ABSMARTLY_CONTEXT) existingContext: any,
  ) {
    if (existingContext) {
      this.sdk = (existingContext as any)['_sdk'];
      this.context = existingContext;
      this.initializeState();
      return;
    }

    this.sdk = new absmartly.SDK({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      environment: config.environment,
      application: config.application,
      retries: config.retries ?? 5,
      timeout: config.timeout ?? 3000,
      eventLogger: config.eventLogger,
    });

    this.context = this.sdk.createContext({
      units: config.units,
      publishDelay: config.publishDelay ?? -1,
      refreshPeriod: config.refreshPeriod ?? 0,
    } as any);

    this.initializeState();
  }

  private initializeState(): void {
    if (this.context.isReady()) {
      this.ready.set(true);
      this.failed.set(this.context.isFailed());
      this.loading.set(false);
      return;
    }

    this.context
      .ready()
      .then(() => {
        this.ready.set(true);
        this.failed.set(this.context.isFailed());
        this.loading.set(false);
        this.error.set(null);
      })
      .catch((e: unknown) => {
        const err = e instanceof Error ? e : new Error(String(e));
        this.error.set(err);
        this.failed.set(true);
        this.loading.set(false);
      });
  }

  treatment(experimentName: string): number {
    return this.context.treatment(experimentName) ?? 0;
  }

  peek(experimentName: string): number {
    return this.context.peek(experimentName) ?? 0;
  }

  variableValue(key: string, defaultValue: string): string {
    return this.context.variableValue(key, defaultValue);
  }

  peekVariableValue(key: string, defaultValue: string): string {
    return this.context.peekVariableValue(key, defaultValue);
  }

  variableKeys(): Record<string, unknown[]> {
    return this.context.variableKeys();
  }

  track(goalName: string, properties?: Record<string, unknown>): void {
    this.context.track(goalName, properties);
  }

  attribute(name: string, value: unknown): void {
    this.context.attribute(name, value);
  }

  attributes(attrs: Record<string, unknown>): void {
    this.context.attributes(attrs);
  }

  getAttribute(name: string): undefined {
    return this.context.getAttribute(name);
  }

  override(experimentName: string, variant: number): void {
    this.context.override(experimentName, variant);
  }

  customAssignment(experimentName: string, variant: number): void {
    this.context.customAssignment(experimentName, variant);
  }

  customFieldValue(experimentName: string, fieldName: string): unknown {
    return this.context.customFieldValue(experimentName, fieldName);
  }

  customFieldKeys(): string[] {
    return this.context.customFieldKeys();
  }

  customFieldValueType(experimentName: string, fieldName: string): string | null {
    return this.context.customFieldValueType(experimentName, fieldName);
  }

  setUnit(type: string, uid: string | number): void {
    this.context.unit(type, uid);
  }

  getUnit(type: string): string | number {
    return this.context.getUnit(type);
  }

  async publish(): Promise<void> {
    await this.context.publish();
  }

  async finalize(): Promise<void> {
    const result = this.context.finalize();
    if (result !== true) {
      await result;
    }
  }

  async refresh(): Promise<void> {
    await this.context.refresh();
  }

  async resetContext(
    units: Record<string, string>,
    options?: ABSmartlyContextOptions,
  ): Promise<void> {
    try {
      await this.context.ready();
      const contextData = this.context.data();
      const result = this.context.finalize();
      if (result !== true) {
        await result;
      }

      this.context = this.sdk.createContextWith(
        { units },
        contextData,
        {
          publishDelay: options?.publishDelay ?? this.config.publishDelay ?? -1,
          refreshPeriod: options?.refreshPeriod ?? this.config.refreshPeriod ?? 0,
        } as any,
      );

      this.ready.set(this.context.isReady());
      this.failed.set(false);
      this.loading.set(!this.context.isReady());
      this.error.set(null);

      this.initializeState();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.error.set(err);
      throw err;
    }
  }

  isReady(): boolean {
    return this.context.isReady();
  }

  isFailed(): boolean {
    return this.context.isFailed();
  }

  isFinalized(): boolean {
    return this.context.isFinalized();
  }

  pending(): number {
    return this.context.pending();
  }

  experiments(): string[] | undefined {
    return this.context.experiments();
  }

  data(): unknown {
    return this.context.data();
  }

  getContext(): any {
    return this.context;
  }

  getSDK(): any {
    return this.sdk;
  }

  ngOnDestroy(): void {
    if (!this.context.isFinalized()) {
      const result = this.context.finalize();
      if (result !== true) {
        result.catch(() => {});
      }
    }
  }
}
