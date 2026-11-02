import { NgModule, type ModuleWithProviders } from '@angular/core';
import { ABSmartlyService } from './absmartly.service.js';
import { ABSMARTLY_CONFIG, type ABSmartlyConfig } from './absmartly.types.js';
import { TreatmentComponent } from './treatment.component.js';
import { TreatmentVariantDirective } from './treatment-variant.directive.js';
import { TreatmentDirective } from './treatment.directive.js';

@NgModule({
  imports: [TreatmentComponent, TreatmentVariantDirective, TreatmentDirective],
  exports: [TreatmentComponent, TreatmentVariantDirective, TreatmentDirective],
})
export class ABSmartlyModule {
  static forRoot(config: ABSmartlyConfig): ModuleWithProviders<ABSmartlyModule> {
    return {
      ngModule: ABSmartlyModule,
      providers: [
        { provide: ABSMARTLY_CONFIG, useValue: config },
        ABSmartlyService,
      ],
    };
  }
}
