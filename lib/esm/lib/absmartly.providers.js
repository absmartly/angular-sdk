import { makeEnvironmentProviders } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { ABSMARTLY_CONFIG } from './absmartly.types';
export function provideABSmartly(config) {
    return makeEnvironmentProviders([
        { provide: ABSMARTLY_CONFIG, useValue: config },
        ABSmartlyService,
    ]);
}
