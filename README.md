# A/B Smartly SDK

A/B Smartly - Angular SDK

## Compatibility

The A/B Smartly Angular SDK is compatible with Angular 16 and later. It supports both standalone components and NgModule-based architectures. The SDK wraps the [@absmartly/javascript-sdk](https://www.github.com/absmartly/javascript-sdk) and provides Angular-native services, components, and directives for seamless integration with Angular's dependency injection system.

## Installation

#### npm

```bash
npm install @absmartly/angular-sdk --save
```

## Getting Started

Please follow the [installation](#installation) instructions before trying the following code.

### Initialization

This example assumes an Api Key, an Application, and an Environment have been created in the A/B Smartly web console.

#### Using Standalone Providers (Recommended)

For applications using standalone components, use the `provideABSmartly` function in your application config:

```typescript
import { provideABSmartly } from '@absmartly/angular-sdk';

export const appConfig = {
  providers: [
    provideABSmartly({
      endpoint: 'https://your-company.absmartly.io/v1',
      apiKey: 'YOUR-API-KEY',
      environment: 'development',
      application: 'website',
      units: { session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8' },
    }),
  ],
};
```

#### Using NgModule

For applications using the traditional NgModule architecture, import `ABSmartlyModule.forRoot()`:

```typescript
import { NgModule } from '@angular/core';
import { ABSmartlyModule } from '@absmartly/angular-sdk';

@NgModule({
  imports: [
    ABSmartlyModule.forRoot({
      endpoint: 'https://your-company.absmartly.io/v1',
      apiKey: 'YOUR-API-KEY',
      environment: 'development',
      application: 'website',
      units: { session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8' },
    }),
  ],
})
export class AppModule {}
```

#### With Optional Parameters

```typescript
provideABSmartly({
  endpoint: 'https://your-company.absmartly.io/v1',
  apiKey: 'YOUR-API-KEY',
  environment: 'development',
  application: 'website',
  units: { session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8' },
  timeout: 5000,
  retries: 3,
  publishDelay: 100,
  refreshPeriod: 0,
});
```

#### With Event Logger

You can provide a custom event logger:

```typescript
provideABSmartly({
  endpoint: 'https://your-company.absmartly.io/v1',
  apiKey: 'YOUR-API-KEY',
  environment: 'development',
  application: 'website',
  units: { session_id: '5ebf06d8cb5d8137290c4abb64155584fbdb64d8' },
  eventLogger: (context, eventName, data) => {
    console.log(`ABSmartly event: ${eventName}`, data);
  },
});
```

**SDK Options**

| Config           | Type                              | Required? |   Default   | Description                                                                                                                                                                   |
| :--------------- | :-------------------------------- | :-------: | :---------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| endpoint         | `string`                          |  &#9989;  | `undefined` | The URL to your API endpoint. Most commonly `"https://your-company.absmartly.io/v1"`                                                                                          |
| apiKey           | `string`                          |  &#9989;  | `undefined` | Your API key which can be found on the Web Console.                                                                                                                           |
| environment      | `string`                          |  &#9989;  | `undefined` | The environment of the platform where the SDK is installed. Environments are created on the Web Console and should match the available environments in your infrastructure.   |
| application      | `string`                          |  &#9989;  | `undefined` | The name of the application where the SDK is installed. Applications are created on the Web Console and should match the applications where your experiments will be running. |
| units            | `Record<string, string>`          |  &#9989;  | `undefined` | A map of unit types to unit identifiers (e.g., `{ session_id: "abc123" }`).                                                                                                   |
| timeout          | `number`                          |  &#10060; | `3000`      | HTTP connection timeout in milliseconds.                                                                                                                                       |
| retries          | `number`                          |  &#10060; | `5`         | Maximum number of retry attempts for failed HTTP requests.                                                                                                                     |
| publishDelay     | `number`                          |  &#10060; | `-1`        | Delay in milliseconds before publishing events. Use `-1` to publish immediately.                                                                                               |
| refreshPeriod    | `number`                          |  &#10060; | `0`         | Period in milliseconds for automatic context refresh. Use `0` to disable.                                                                                                      |
| eventLogger      | `(context, eventName, data) => void` |  &#10060; | `undefined` | Callback to handle SDK events (ready, exposure, goal, etc.)                                                                                                                   |

## Creating a New Context

The Angular SDK automatically creates a context during service initialization using the `units` provided in the configuration. The `ABSmartlyService` exposes reactive signals to track the context state.

### Checking Context Readiness

```typescript
import { Component, inject } from '@angular/core';
import { ABSmartlyService } from '@absmartly/angular-sdk';

@Component({
  selector: 'app-root',
  template: `
    @if (absmartly.loading()) {
      <p>Loading experiments...</p>
    } @else if (absmartly.failed()) {
      <p>Failed to load experiments</p>
    } @else {
      <app-main-content />
    }
  `,
})
export class AppComponent {
  absmartly = inject(ABSmartlyService);
}
```

### With Pre-fetched Data

You can inject a pre-existing context using the `ABSMARTLY_CONTEXT` injection token, avoiding a round-trip to the collector:

```typescript
import { ABSMARTLY_CONTEXT } from '@absmartly/angular-sdk';

// Provide an existing context obtained from server-side rendering or another source
providers: [
  { provide: ABSMARTLY_CONTEXT, useValue: existingContext },
]
```

### Refreshing the Context with Fresh Experiment Data

```typescript
const absmartly = inject(ABSmartlyService);

await absmartly.refresh();
```

### Setting Extra Units

You can add additional units to a context by calling the `setUnit()` method. This is useful when a user logs in and you want to associate the new identity with the context. Note that you cannot override an already set unit type.

```typescript
absmartly.setUnit('db_user_id', '1000013');
```

### Resetting the Context

When you need to create a new context with different units (for example, after a user logs out and a new user logs in), use the `resetContext()` method. This finalizes the current context and creates a new one with pre-fetched data:

```typescript
await absmartly.resetContext(
  { session_id: 'new-session-id', db_user_id: '2000042' },
  { publishDelay: 100, refreshPeriod: 0 }
);
```

## Basic Usage

### Selecting a Treatment

#### Programmatic Usage

```typescript
import { Component, inject } from '@angular/core';
import { ABSmartlyService } from '@absmartly/angular-sdk';

@Component({
  selector: 'app-product',
  template: `
    @if (treatment === 0) {
      <app-product-control />
    } @else {
      <app-product-treatment />
    }
  `,
})
export class ProductComponent {
  private absmartly = inject(ABSmartlyService);
  treatment = this.absmartly.treatment('exp_test_experiment');
}
```

#### Using the Treatment Component

The `TreatmentComponent` provides declarative, template-driven variant rendering:

```typescript
import { Component } from '@angular/core';
import { TreatmentComponent, TreatmentVariantDirective } from '@absmartly/angular-sdk';

@Component({
  selector: 'app-experiment',
  standalone: true,
  imports: [TreatmentComponent, TreatmentVariantDirective],
  template: `
    <abs-treatment name="exp_button_color">
      <ng-template absTreatmentVariant="loading">
        <p>Loading...</p>
      </ng-template>
      <ng-template [absTreatmentVariant]="0">
        <button class="btn-blue">Control: Blue Button</button>
      </ng-template>
      <ng-template [absTreatmentVariant]="1">
        <button class="btn-green">Treatment: Green Button</button>
      </ng-template>
      <ng-template absTreatmentVariant="error">
        <button class="btn-blue">Fallback: Blue Button</button>
      </ng-template>
    </abs-treatment>
  `,
})
export class ExperimentComponent {}
```

Variant directives support matching by number, string, letter (A=0, B=1, C=2...), or the special values `"loading"`, `"error"`, and `"default"`.

#### Using the Treatment Directive

The `TreatmentDirective` provides the variant and variables as a template context:

```typescript
import { Component } from '@angular/core';
import { TreatmentDirective } from '@absmartly/angular-sdk';

@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [TreatmentDirective],
  template: `
    <ng-container *absTreatment="'exp_test_experiment'; let variant; let variables = variables; let loading = loading">
      @if (loading) {
        <p>Loading...</p>
      } @else if (variant === 0) {
        <p>Control group</p>
      } @else {
        <p>Treatment group</p>
      }
    </ng-container>
  `,
})
export class FeatureComponent {}
```

### Treatment Variables

```typescript
const buttonColor = absmartly.variableValue('button_color', 'blue');
```

### Peek at Treatment Variants

Although generally not recommended, it is sometimes necessary to peek at a treatment or variable without triggering an exposure. The `peek()` and `peekVariableValue()` methods serve this purpose.

```typescript
const treatment = absmartly.peek('exp_test_experiment');
```

#### Peeking at Variables

```typescript
const buttonColor = absmartly.peekVariableValue('button_color', 'blue');
```

The `TreatmentComponent` also supports peeking via the `peek` input:

```html
<abs-treatment name="exp_test_experiment" [peek]="true">
  <!-- variant templates -->
</abs-treatment>
```

### Overriding Treatment Variants

During development, for example, it is useful to force a treatment for an experiment. This can be achieved with the `override()` method.

```typescript
absmartly.override('exp_test_experiment', 1);
```

## Advanced

### Context Attributes

```typescript
absmartly.attribute('user_agent', navigator.userAgent);

absmartly.attributes({
  customer_age: 'new_customer',
  url: window.location.href,
});
```

### Custom Assignments

```typescript
absmartly.customAssignment('exp_test_experiment', 1);
```

### Custom Field Values

```typescript
const fieldValue = absmartly.customFieldValue('exp_test_experiment', 'my_field');
const fieldKeys = absmartly.customFieldKeys();
const fieldType = absmartly.customFieldValueType('exp_test_experiment', 'my_field');
```

### Tracking Goals

Goals are created in the A/B Smartly web console.

```typescript
absmartly.track('payment', {
  item_count: 1,
  total_amount: 1999.99,
});
```

### Publishing Pending Data

Sometimes it is necessary to ensure all events have been published to the A/B Smartly collector, before proceeding. You can explicitly call the `publish()` method.

```typescript
await absmartly.publish();
```

### Finalizing

The `finalize()` method will ensure all events have been published to the A/B Smartly collector, like `publish()`, and will also "seal" the context, throwing an error if any method that could generate an event is called. The context is also automatically finalized when the `ABSmartlyService` is destroyed (via Angular's `OnDestroy` lifecycle).

```typescript
await absmartly.finalize();
```

### Context State

```typescript
absmartly.isReady();
absmartly.isFailed();
absmartly.isFinalized();
absmartly.pending();
absmartly.experiments();
absmartly.data();
```

### Reactive Signals

The `ABSmartlyService` exposes Angular signals for reactive state management:

```typescript
absmartly.ready();    // Signal<boolean> - true when context is ready
absmartly.failed();   // Signal<boolean> - true when context initialization failed
absmartly.loading();  // Signal<boolean> - true while context is initializing
absmartly.error();    // Signal<Error | null> - error if initialization failed
```

### Accessing the Underlying SDK

For advanced use cases, you can access the underlying JavaScript SDK context and SDK instances directly:

```typescript
const context = absmartly.getContext();
const sdk = absmartly.getSDK();
```

### Custom Event Logger

The A/B Smartly SDK can be instantiated with an event logger used for all contexts. The event logger receives the context, event name, and event data.

```typescript
provideABSmartly({
  endpoint: 'https://your-company.absmartly.io/v1',
  apiKey: 'YOUR-API-KEY',
  environment: 'development',
  application: 'website',
  units: { session_id: 'abc123' },
  eventLogger: (context, eventName, data) => {
    switch (eventName) {
      case 'exposure':
        console.log('Exposed to experiment:', data.name);
        break;
      case 'goal':
        console.log('Goal tracked:', data.name);
        break;
      case 'error':
        console.error('SDK error:', data);
        break;
      case 'ready':
      case 'refresh':
      case 'publish':
      case 'finalize':
        break;
    }
  },
});
```

**Event Types**

| Event      | When                                                       | Data                                   |
| ---------- | ---------------------------------------------------------- | -------------------------------------- |
| `error`    | `Context` receives an error                                | `Error` object                         |
| `ready`    | `Context` turns ready                                      | `ContextData` used to initialize       |
| `refresh`  | `Context.refresh()` method succeeds                        | `ContextData` used to refresh          |
| `publish`  | `Context.publish()` method succeeds                        | `PublishEvent` sent to collector       |
| `exposure` | `Context.treatment()` succeeds on first exposure           | `Exposure` enqueued for publishing     |
| `goal`     | `Context.track()` method succeeds                          | `GoalAchievement` enqueued for publishing |
| `finalize` | `Context.finalize()` method succeeds the first time        | `null`                                 |

## About A/B Smartly

**A/B Smartly** is the leading provider of state-of-the-art, on-premises, full-stack experimentation platforms for engineering and product teams that want to confidently deploy features as fast as they can develop them.
A/B Smartly's real-time analytics helps engineering and product teams ensure that new features will improve the customer experience without breaking or degrading performance and/or business metrics.

### Have a look at our growing list of clients and SDKs:
- [Java SDK](https://www.github.com/absmartly/java-sdk)
- [JavaScript SDK](https://www.github.com/absmartly/javascript-sdk)
- [PHP SDK](https://www.github.com/absmartly/php-sdk)
- [Swift SDK](https://www.github.com/absmartly/swift-sdk)
- [Vue2 SDK](https://www.github.com/absmartly/vue2-sdk)
- [Vue3 SDK](https://www.github.com/absmartly/vue3-sdk)
- [React SDK](https://www.github.com/absmartly/react-sdk)
- [Angular SDK](https://www.github.com/absmartly/angular-sdk) (this package)
- [Python3 SDK](https://www.github.com/absmartly/python3-sdk)
- [Go SDK](https://www.github.com/absmartly/go-sdk)
- [Ruby SDK](https://www.github.com/absmartly/ruby-sdk)
- [.NET SDK](https://www.github.com/absmartly/dotnet-sdk)
- [Dart SDK](https://www.github.com/absmartly/dart-sdk)
- [Flutter SDK](https://www.github.com/absmartly/flutter-sdk)
