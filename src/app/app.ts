import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/ui/toast/toast';

@Component({
  selector: 'ta-root',
  imports: [RouterOutlet, Toast],
  template: '<router-outlet /><ta-toast />',
})
export class App {}
