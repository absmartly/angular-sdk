import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreatmentVariantDirective } from '../src/lib/treatment-variant.directive';

@Component({
  template: `<ng-template absTreatmentVariant="0" #variant>Content</ng-template>`,
  standalone: true,
  imports: [TreatmentVariantDirective],
})
class TestHostComponent {
  @ViewChild(TreatmentVariantDirective) directive!: TreatmentVariantDirective;
}

@Component({
  template: `<ng-template [absTreatmentVariant]="1" #variant>Content</ng-template>`,
  standalone: true,
  imports: [TreatmentVariantDirective],
})
class TestHostNumberComponent {
  @ViewChild(TreatmentVariantDirective) directive!: TreatmentVariantDirective;
}

@Component({
  template: `<ng-template absTreatmentVariant="loading" #variant>Loading...</ng-template>`,
  standalone: true,
  imports: [TreatmentVariantDirective],
})
class TestHostLoadingComponent {
  @ViewChild(TreatmentVariantDirective) directive!: TreatmentVariantDirective;
}

describe('TreatmentVariantDirective', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should accept string variant "0"', () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.directive.absTreatmentVariant).toBe('0');
  });

  it('should accept number variant 1', () => {
    TestBed.configureTestingModule({
      imports: [TestHostNumberComponent],
    });
    const fixture = TestBed.createComponent(TestHostNumberComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.directive.absTreatmentVariant).toBe(1);
  });

  it('should accept string variant "loading"', () => {
    TestBed.configureTestingModule({
      imports: [TestHostLoadingComponent],
    });
    const fixture = TestBed.createComponent(TestHostLoadingComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.directive.absTreatmentVariant).toBe('loading');
  });

  it('should have templateRef', () => {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.directive.templateRef).toBeTruthy();
  });
});
