var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Component, ContentChildren, Input, ViewContainerRef, ViewChild, inject, signal, } from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { TreatmentVariantDirective } from './treatment-variant.directive';
let TreatmentComponent = class TreatmentComponent {
    constructor() {
        this.peek = false;
        this.absmartly = inject(ABSmartlyService);
        this.destroyed = false;
        this.variant = signal(0);
        this.loading = signal(true);
        this.error = signal(null);
    }
    ngOnInit() {
        if (this.attributes) {
            this.absmartly.attributes(this.attributes);
        }
        const context = this.absmartly.getContext();
        if (context.isReady()) {
            this.resolveVariant();
            return;
        }
        context
            .ready()
            .then(() => {
            if (!this.destroyed) {
                this.resolveVariant();
            }
        })
            .catch((e) => {
            if (!this.destroyed) {
                const err = e instanceof Error ? e : new Error(String(e));
                this.error.set(err);
                this.loading.set(false);
            }
        });
    }
    ngAfterContentInit() {
        if (!this.loading()) {
            this.renderVariant();
        }
    }
    resolveVariant() {
        const value = this.peek
            ? this.absmartly.peek(this.name)
            : this.absmartly.treatment(this.name);
        this.variant.set(value);
        this.loading.set(false);
        this.error.set(null);
        this.renderVariant();
    }
    renderVariant() {
        this.container.clear();
        if (!this.variants)
            return;
        const errorDirective = this.error()
            ? this.variants.find((v) => v.absTreatmentVariant === 'error')
            : null;
        if (errorDirective) {
            this.container.createEmbeddedView(errorDirective.templateRef);
            return;
        }
        const loadingDirective = this.loading()
            ? this.variants.find((v) => v.absTreatmentVariant === 'loading')
            : null;
        if (loadingDirective) {
            this.container.createEmbeddedView(loadingDirective.templateRef);
            return;
        }
        const currentVariant = this.variant();
        const variantLetter = String.fromCharCode(65 + currentVariant);
        const match = this.variants.find((v) => v.absTreatmentVariant === currentVariant) ??
            this.variants.find((v) => v.absTreatmentVariant === String(currentVariant)) ??
            this.variants.find((v) => v.absTreatmentVariant === variantLetter) ??
            this.variants.find((v) => v.absTreatmentVariant === 'default') ??
            this.variants.first;
        if (match) {
            this.container.createEmbeddedView(match.templateRef);
        }
    }
    ngOnDestroy() {
        this.destroyed = true;
    }
};
__decorate([
    Input({ required: true })
], TreatmentComponent.prototype, "name", void 0);
__decorate([
    Input()
], TreatmentComponent.prototype, "attributes", void 0);
__decorate([
    Input()
], TreatmentComponent.prototype, "peek", void 0);
__decorate([
    ContentChildren(TreatmentVariantDirective)
], TreatmentComponent.prototype, "variants", void 0);
__decorate([
    ViewChild('container', { read: ViewContainerRef, static: true })
], TreatmentComponent.prototype, "container", void 0);
TreatmentComponent = __decorate([
    Component({
        selector: 'abs-treatment',
        standalone: true,
        template: '<ng-container #container></ng-container>',
    })
], TreatmentComponent);
export { TreatmentComponent };
