import { NgModule, type ModuleWithProviders } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { ABSMARTLY_CONFIG, type ABSmartlyConfig } from './absmartly.types';
import { TreatmentComponent } from './treatment.component';
import { TreatmentVariantDirective } from './treatment-variant.directive';
import { TreatmentDirective } from './treatment.directive';

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
