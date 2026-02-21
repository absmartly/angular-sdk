import {
  Directive,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { ABSmartlyService } from './absmartly.service';

export interface TreatmentContext {
  $implicit: number;
  variant: number;
  variables: Record<string, unknown>;
  loading: boolean;
}

@Directive({
  selector: '[absTreatment]',
  standalone: true,
})
export class TreatmentDirective implements OnInit, OnDestroy {
  @Input({ required: true }) absTreatment!: string;
  @Input() absTreatmentAttributes?: Record<string, unknown>;

  private absmartly = inject(ABSmartlyService);
  private templateRef = inject(TemplateRef<TreatmentContext>);
  private viewContainer = inject(ViewContainerRef);
  private destroyed = false;

  ngOnInit(): void {
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

  private render(): void {
    this.viewContainer.clear();

    const variant = this.absmartly.treatment(this.absTreatment);
    const variableKeysMap = this.absmartly.variableKeys();
    const variables: Record<string, unknown> = {};
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

  ngOnDestroy(): void {
    this.destroyed = true;
  }
}
