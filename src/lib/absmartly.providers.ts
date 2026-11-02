import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { ABSmartlyService } from './absmartly.service.js';
import { ABSMARTLY_CONFIG, type ABSmartlyConfig } from './absmartly.types.js';

export function provideABSmartly(config: ABSmartlyConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ABSMARTLY_CONFIG, useValue: config },
    ABSmartlyService,
  ]);
}
