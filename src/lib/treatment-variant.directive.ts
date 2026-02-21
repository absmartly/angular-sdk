import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: '[absTreatmentVariant]',
  standalone: true,
})
export class TreatmentVariantDirective {
  @Input({ required: true }) absTreatmentVariant!: number | string;

  constructor(public templateRef: TemplateRef<unknown>) {}
}
