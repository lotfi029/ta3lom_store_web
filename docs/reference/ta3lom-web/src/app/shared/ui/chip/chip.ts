import { Component, input } from '@angular/core';

@Component({
  selector: 'ta-chip',
  templateUrl: './chip.html',
  styleUrl: './chip.css',
})
export class Chip {
  readonly tone = input<'brand' | 'gold'>('brand');
}
