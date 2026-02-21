var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ABSmartlyModule_1;
import { NgModule } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { ABSMARTLY_CONFIG } from './absmartly.types';
import { TreatmentComponent } from './treatment.component';
import { TreatmentVariantDirective } from './treatment-variant.directive';
import { TreatmentDirective } from './treatment.directive';
let ABSmartlyModule = ABSmartlyModule_1 = class ABSmartlyModule {
    static forRoot(config) {
        return {
            ngModule: ABSmartlyModule_1,
            providers: [
                { provide: ABSMARTLY_CONFIG, useValue: config },
                ABSmartlyService,
            ],
        };
    }
};
ABSmartlyModule = ABSmartlyModule_1 = __decorate([
    NgModule({
        imports: [TreatmentComponent, TreatmentVariantDirective, TreatmentDirective],
        exports: [TreatmentComponent, TreatmentVariantDirective, TreatmentDirective],
    })
], ABSmartlyModule);
export { ABSmartlyModule };
