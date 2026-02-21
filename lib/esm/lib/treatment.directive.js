var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Directive, Input, TemplateRef, ViewContainerRef, inject, } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
let TreatmentDirective = class TreatmentDirective {
    constructor() {
        this.absmartly = inject(ABSmartlyService);
        this.templateRef = inject((TemplateRef));
        this.viewContainer = inject(ViewContainerRef);
        this.destroyed = false;
    }
    ngOnInit() {
        if (this.absTreatmentAttributes) {
            this.absmartly.attributes(this.absTreatmentAttributes);
        }
        const context = this.absmartly.getContext();
        if (context.isReady()) {
            this.render();
            return;
        }
        this.viewContainer.createEmbeddedView(this.templateRef, {
            $implicit: 0,
            variant: 0,
            variables: {},
            loading: true,
        });
        context
            .ready()
            .then(() => {
            if (!this.destroyed) {
                this.render();
            }
        })
            .catch(() => {
            if (!this.destroyed) {
                this.render();
            }
        });
    }
    render() {
        this.viewContainer.clear();
        const variant = this.absmartly.treatment(this.absTreatment);
        const variableKeysMap = this.absmartly.variableKeys();
        const variables = {};
        for (const key of Object.keys(variableKeysMap)) {
            variables[key] = this.absmartly.peekVariableValue(key, '');
        }
        this.viewContainer.createEmbeddedView(this.templateRef, {
            $implicit: variant,
            variant,
            variables,
            loading: false,
        });
    }
    ngOnDestroy() {
        this.destroyed = true;
    }
};
__decorate([
    Input({ required: true })
], TreatmentDirective.prototype, "absTreatment", void 0);
__decorate([
    Input()
], TreatmentDirective.prototype, "absTreatmentAttributes", void 0);
TreatmentDirective = __decorate([
    Directive({
        selector: '[absTreatment]',
        standalone: true,
    })
], TreatmentDirective);
export { TreatmentDirective };
