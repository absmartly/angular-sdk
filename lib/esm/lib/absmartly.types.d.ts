import { InjectionToken } from '@angular/core';
import type { Context, SDK } from '@absmartly/javascript-sdk';
export interface ABSmartlyConfig {
    endpoint: string;
    apiKey: string;
    environment: string;
    application: string;
    retries?: number;
    timeout?: number;
    units: Record<string, string>;
    publishDelay?: number;
    refreshPeriod?: number;
    eventLogger?: (context: Context, eventName: string, data: unknown) => void;
}
export interface ABSmartlyContextOptions {
    publishDelay?: number;
    refreshPeriod?: number;
}
export type EventNameType = 'error' | 'ready' | 'refresh' | 'publish' | 'exposure' | 'goal' | 'finalize';
export type ABSmartlyContext = Context;
export type ABSmartlySDK = SDK;
export declare const ABSMARTLY_CONFIG: InjectionToken<ABSmartlyConfig>;
export declare const ABSMARTLY_CONTEXT: InjectionToken<Context>;
