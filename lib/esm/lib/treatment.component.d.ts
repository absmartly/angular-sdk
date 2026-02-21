import { OnDestroy, OnInit, QueryList, ViewContainerRef, type AfterContentInit } from '@angular/core';
import { TreatmentVariantDirective } from './treatment-variant.directive';
export declare class TreatmentComponent implements OnInit, AfterContentInit, OnDestroy {
    name: string;
    attributes?: Record<string, unknown>;
    peek: boolean;
    variants: QueryList<TreatmentVariantDirective>;
    container: ViewContainerRef;
    private absmartly;
    private destroyed;
    readonly variant: import("@angular/core").WritableSignal<number>;
    readonly loading: import("@angular/core").WritableSignal<boolean>;
    readonly error: import("@angular/core").WritableSignal<Error | null>;
    ngOnInit(): void;
    ngAfterContentInit(): void;
    private resolveVariant;
    private renderVariant;
    ngOnDestroy(): void;
}
