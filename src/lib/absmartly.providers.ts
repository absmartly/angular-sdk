import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { ABSMARTLY_CONFIG, type ABSmartlyConfig } from './absmartly.types';

export function provideABSmartly(config: ABSmartlyConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ABSMARTLY_CONFIG, useValue: config },
    ABSmartlyService,
  ]);
}
