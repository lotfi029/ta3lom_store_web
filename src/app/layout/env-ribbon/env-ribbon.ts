import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Environment ribbon. This default renders NOTHING: production, CI and local builds ship no ribbon code or text.
 * The `staging` build configuration replaces this file with env-ribbon.staging.ts (angular.json fileReplacements).
 */
@Component({
  selector: 'ta-env-ribbon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class EnvRibbon {}
