import { OnDestroy, OnInit } from '@angular/core';
export interface TreatmentContext {
    $implicit: number;
    variant: number;
    variables: Record<string, unknown>;
    loading: boolean;
}
export declare class TreatmentDirective implements OnInit, OnDestroy {
    absTreatment: string;
    absTreatmentAttributes?: Record<string, unknown>;
    private absmartly;
    private templateRef;
    private viewContainer;
    private destroyed;
    ngOnInit(): void;
    private render;
    ngOnDestroy(): void;
}
