import {
  Component,
  ContentChildren,
  Input,
  OnDestroy,
  OnInit,
  QueryList,
  ViewContainerRef,
  ViewChild,
  inject,
  signal,
  type AfterContentInit,
} from '@angular/core';
import { ABSmartlyService } from './absmartly.service';
import { TreatmentVariantDirective } from './treatment-variant.directive';

@Component({
  selector: 'abs-treatment',
  standalone: true,
  template: '<ng-container #container></ng-container>',
})
export class TreatmentComponent implements OnInit, AfterContentInit, OnDestroy {
  @Input({ required: true }) name!: string;
  @Input() attributes?: Record<string, unknown>;
  @Input() peek = false;

  @ContentChildren(TreatmentVariantDirective, { descendants: true }) variants!: QueryList<TreatmentVariantDirective>;
  @ViewChild('container', { read: ViewContainerRef, static: true }) container!: ViewContainerRef;

  private absmartly = inject(ABSmartlyService);
  private destroyed = false;
  private contentReady = false;

  readonly variant = signal<number>(0);
  readonly loading = signal(true);
  readonly error = signal<Error | null>(null);

  ngOnInit(): void {
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
      .catch((e: unknown) => {
        if (!this.destroyed) {
          const err = e instanceof Error ? e : new Error(String(e));
          this.error.set(err);
          this.loading.set(false);
          if (this.contentReady) {
            this.renderVariant();
          }
        }
      });
  }

  ngAfterContentInit(): void {
    this.contentReady = true;
    if (!this.loading()) {
      this.renderVariant();
    }
  }

  private resolveVariant(): void {
    const value = this.peek
      ? this.absmartly.peek(this.name)
      : this.absmartly.treatment(this.name);
    this.variant.set(value);
    this.loading.set(false);
    this.error.set(null);
    if (this.contentReady) {
      this.renderVariant();
    }
  }

  private renderVariant(): void {
    this.container.clear();

    if (!this.variants) return;

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
    const variantStr = String(currentVariant);
    const variantLetter = String.fromCharCode(65 + currentVariant);

    const match =
      this.variants.find((v) => String(v.absTreatmentVariant) === variantStr) ??
      this.variants.find((v) => v.absTreatmentVariant === variantLetter) ??
      this.variants.find((v) => v.absTreatmentVariant === 'default') ??
      this.variants.first;

    if (match) {
      this.container.createEmbeddedView(match.templateRef);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }
}
