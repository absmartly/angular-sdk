# Angular SDK Fix Plan

Based on full review of PR #1.

## Critical

### 1. Remove node_modules from git history
- **Issue**: Initial commit included 16,788 node_modules files (~136MB). Later commit stopped tracking but files remain in history.
- **Fix**: Either squash all commits into one clean commit (preferred for a new repo), or use `git filter-branch` / `git filter-repo` to purge node_modules from history. Since this is PR #1, squashing is cleanest.

### 2. Reconcile source/build output mismatch
- **File**: `src/lib/absmartly.service.ts:25` vs `lib/esm/lib/absmartly.service.js:20-21`
- **Issue**: Source always creates new SDK even with `existingContext`. Build output correctly uses `existingContext.getSDK()`. They represent different logic.
- **Fix**:
  1. Fix the source to match the correct build logic: check `existingContext` first and use `existingContext.getSDK()` if available
  2. Rebuild: `npm run build`
  3. Verify build output matches source

## Important

### 3. Add LICENSE file
- **Issue**: `package.json` declares Apache-2.0 and includes `LICENSE` in files array, but no LICENSE file exists.
- **Fix**: Add the Apache-2.0 LICENSE file to the repo root.

### 4. Stop tracking `lib/` build artifacts
- **Fix**:
  1. Add `lib/` to `.gitignore`
  2. Remove tracked files: `git rm -r --cached lib/`
  3. Ensure CI/publish pipeline builds before publishing

### 5. Remove internal status document
- **File**: `ANGULAR_SDK_COMPLETION.md`
- **Fix**: Delete this file. Move any useful info to a GitHub issue or wiki.

## Minor

### 6. Fix `as any` type casts
- **File**: `src/lib/absmartly.service.ts:37,175`
- **Fix**: Define proper type interfaces for the JS SDK context/SDK objects, or use type assertion with the correct type.

### 7. Add return types to getContext/getSDK
- **File**: `src/lib/absmartly.service.ts:215-221`
- **Fix**: Return `Context` and `SDK` types instead of `any`.

### 8. Support non-string variable values
- **File**: `src/lib/absmartly.service.ts:86-92`
- **Fix**: Change `variableValue` and `peekVariableValue` to accept generic type parameter: `variableValue<T>(key: string, defaultValue: T): T`.

### 9. Scope TreatmentDirective variable keys
- **File**: `src/lib/treatment.directive.ts:69-72`
- **Fix**: Filter `variableKeys()` to only keys belonging to the specific experiment.

### 10. Fix async test helper
- **File**: `tests/absmartly.service.spec.ts:318`
- **Fix**: Replace `setTimeout` with `flushMicrotasks()` or `fakeAsync` from Angular testing utilities.

## Additional Findings (Full Review v2)

### Important

#### 11. TreatmentComponent race condition between ngOnInit and ngAfterContentInit
- **File**: `src/lib/treatment.component.ts:49-68`
- **Issue**: When the context resolves its `ready()` promise between `ngOnInit` and `ngAfterContentInit`, `resolveVariant()` calls `renderVariant()` but `this.variants` (the `@ContentChildren` QueryList) may not yet be initialized — it's only guaranteed populated after `ngAfterContentInit`. The `if (!this.variants) return` guard at line 84 catches null but the timing window means a resolved context + slow content init = no rendered variant until something else triggers re-render.
- **Fix**: Move the async resolution logic so that `renderVariant()` is only called after `ngAfterContentInit` has fired. Use a flag like `contentReady = false`, set it in `ngAfterContentInit`, and gate `renderVariant()` on it.

#### 12. Duplicate `createMockContext` helper across 4 test files
- **Files**: `tests/absmartly.service.spec.ts`, `tests/treatment.directive.spec.ts`, `tests/treatment.component.spec.ts`, `tests/integration.spec.ts`
- **Issue**: The `createMockContext()` function is copy-pasted across 4 test files with slight variations (e.g., different default return values for `treatment`, `variableValue`, etc.). This makes it easy for mocks to drift out of sync.
- **Fix**: Extract into a shared `tests/helpers.ts` module. Each test can override specific methods via the existing `overrides` parameter.

#### 13. ABSmartlyService is not `providedIn: 'root'` — no singleton guarantee at app level
- **File**: `src/lib/absmartly.service.ts:11`
- **Issue**: The service uses `@Injectable()` without `providedIn: 'root'`. While the module/provider functions register it, lazy-loaded modules that import ABSmartlyModule.forRoot() independently will each get their own instance, creating multiple SDK connections and contexts.
- **Fix**: Document this clearly in the README (that `forRoot` / `provideABSmartly` should only be called once in the root module/bootstrap), or consider using `providedIn: 'root'` with a factory that reads the injection token.

### Minor

#### 14. Missing `OnDestroy` import in service
- **File**: `src/lib/absmartly.service.ts:1`
- **Issue**: `OnDestroy` is imported and the class `implements OnDestroy`, but this is cosmetic — Angular doesn't require the interface for lifecycle hook detection. However, the import is correct for type-checking purposes. No action needed, just noting for completeness.

#### 15. `EventNameType` exported but never used internally
- **File**: `src/lib/absmartly.types.ts:22-29`
- **Issue**: `EventNameType` is defined and exported via `index.ts` but never used by any service, directive, or component. It's a dead type unless consumers need it.
- **Fix**: Either remove it or document its intended usage for consumers (e.g., for `eventLogger` callback filtering).

#### 16. TreatmentComponent variant matching uses loose string comparison
- **File**: `src/lib/treatment.component.ts:107-112`
- **Issue**: The variant matching chain tries `currentVariant` (number), `String(currentVariant)` (string), and `variantLetter` (A/B/C). Since `@Input() absTreatmentVariant` accepts `number | string`, and template attributes are strings by default (e.g., `absTreatmentVariant="0"` is string `"0"`, not number `0`), the first `find` (comparing number to string) will almost always miss and fall through to the second. This works but is unnecessarily complex.
- **Fix**: Normalize the comparison by converting both sides to the same type, or document clearly that template usage should use string values.

#### 17. No `ngOnChanges` support in TreatmentDirective or TreatmentComponent
- **File**: `src/lib/treatment.directive.ts`, `src/lib/treatment.component.ts`
- **Issue**: If the experiment `name` input changes dynamically (e.g., `[name]="currentExp"`), neither component/directive re-evaluates the treatment. They only resolve once in `ngOnInit`.
- **Fix**: Either implement `OnChanges` to re-resolve on input changes, or document that inputs must be static.

## Additional Findings (Full Review v3)

### Important

#### 18. `resetContext()` does not handle already-finalized context
- **File**: `src/lib/absmartly.service.ts:157-189`
- **Issue**: `resetContext()` calls `this.context.ready()` and then `this.context.finalize()`, but never checks `this.context.isFinalized()` first. If the context is already finalized (e.g., user called `finalize()` manually before `resetContext()`), calling `finalize()` again on the JS SDK context may throw or behave unexpectedly. The `ngOnDestroy` method correctly checks `isFinalized()` before calling finalize, but `resetContext` does not.
- **Fix**: Add `if (!this.context.isFinalized())` guard before the finalize call in `resetContext()`, consistent with the pattern used in `ngOnDestroy()`.

#### 19. `TreatmentDirective` swallows errors silently — no error state exposed
- **File**: `src/lib/treatment.directive.ts:58-62`
- **Issue**: When the context promise rejects in the `.catch()` block, the directive calls `this.render()` which sets `loading: false` but provides no indication that an error occurred. The `TreatmentContext` interface has `loading` but no `error` or `failed` field. Compare with `TreatmentComponent` which has `error` signal and renders error-specific templates. Users of `TreatmentDirective` have no way to detect or handle initialization failures.
- **Fix**: Add `error` and/or `failed` fields to `TreatmentContext` interface and populate them in the `.catch()` handler. Update the embedded view context accordingly.

#### 20. `TreatmentDirective.render()` triggers exposure even on error path
- **File**: `src/lib/treatment.directive.ts:58-62, 65-81`
- **Issue**: When context initialization fails (`.catch()`), the directive calls `this.render()` which calls `this.absmartly.treatment(this.absTreatment)` at line 68. This triggers an exposure event on a failed/possibly-invalid context. The `TreatmentComponent` correctly avoids this by rendering an error template instead.
- **Fix**: In the `.catch()` handler, render with `variant: 0, loading: false, error: true` without calling `treatment()`, or use `peek()` instead to avoid triggering an exposure.

#### 21. Build output diverges from source beyond item #2 — confirms build artifacts are from a different source version
- **File**: `src/lib/absmartly.service.ts:37` vs `lib/esm/lib/absmartly.service.js:35-39`
- **Issue**: Beyond the already-documented SDK creation mismatch (fix-plan #2), the build output calls `createContext`/`createContextWith` without the `as any` casts present in the source. This confirms the build artifacts are from a different (possibly more correct) version of the source than what's committed.
- **Fix**: Already partially covered by fix-plan #2 and #4. Rebuild from current source after fixing the source, and stop tracking `lib/` entirely.

### Minor

#### 22. `TreatmentComponent` `@ContentChildren` won't match deeply nested variant directives
- **File**: `src/lib/treatment.component.ts:27`
- **Issue**: `@ContentChildren(TreatmentVariantDirective)` defaults to `descendants: false`, meaning it only queries direct content children. If a user wraps variant templates in an intermediate element, the query won't find them.
- **Fix**: Either add `{ descendants: true }` to the query, or document that variant directives must be direct children of `<abs-treatment>`.

#### 23. `peekVariableValue` default value hardcoded to empty string in `TreatmentDirective`
- **File**: `src/lib/treatment.directive.ts:72`
- **Issue**: `this.absmartly.peekVariableValue(key, '')` always uses empty string as default. This means numeric, boolean, or object variable values that are missing will be coerced to empty string. Subtly incorrect for non-string variable types.
- **Fix**: Use `null` or `undefined` as default, or use proper typing (relates to fix-plan #8 about generic type support).

#### 24. Forward-compatibility: consider signal-based queries for Angular 17+
- **File**: `src/lib/treatment.component.ts:27`
- **Issue**: `@ContentChildren` with `QueryList` works for Angular 16+ but signal-based `contentChildren()` is the preferred approach in Angular 17+. No current leak, but the `QueryList` API is being deprecated in favor of signals.
- **Fix**: Low priority — consider migrating to `contentChildren()` when minimum Angular version is bumped to 17+.

#### 25. `setUnit` method name inconsistency with underlying SDK
- **File**: `src/lib/absmartly.service.ts:134-136`
- **Issue**: Public method is `setUnit()` but delegates to `this.context.unit()`. `getUnit()` maps to `context.getUnit()` consistently, but the setter is asymmetric.
- **Fix**: Document the mapping, or add `unit()` as an alias.

#### 26. Test configuration files not visible in PR diff
- **File**: `tests/setup.ts`, jest config
- **Issue**: The test setup file and jest configuration are not visible in the PR diff. Tests use `jest-preset-angular` but configuration reviewability is limited.
- **Fix**: Ensure jest config and setup files are included in the PR for reviewability.
