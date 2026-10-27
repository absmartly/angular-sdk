import { Directive, Input, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: '[absTreatmentVariant]',
  standalone: true,
})
export class TreatmentVariantDirective {
  @Input({ required: true }) absTreatmentVariant!: number | string;

  // inject() rather than a constructor parameter: the published build is plain
  // tsc output without decorator metadata, so Angular cannot resolve
  // constructor parameters when an app compiles it at runtime.
  readonly templateRef: TemplateRef<unknown> = inject(TemplateRef);
}
