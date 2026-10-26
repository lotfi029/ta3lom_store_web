import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Block, type Inline, parseMarkdown } from '../../util/markdown';

/**
 * Renders a project story (Markdown subset, C-5) with Angular templates only: no `innerHTML`, no sanitizer bypass —
 * the parser emits allowed nodes and every piece of text is set as `textContent` (spans keep the source's spacing
 * exact around inline markup). Links: `rel="noopener noreferrer"`,
 * external ones in a new tab.
 */
@Component({
  selector: 'ta-markdown',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #inl let-nodes>
      @for (n of asInlines(nodes); track $index) {
        @switch (n.kind) {
          @case ('text') {
            <span [textContent]="textOf(n)"></span>
          }
          @case ('strong') {
            <strong
              ><ng-container *ngTemplateOutlet="inl; context: { $implicit: childrenOf(n) }"
            /></strong>
          }
          @case ('em') {
            <em><ng-container *ngTemplateOutlet="inl; context: { $implicit: childrenOf(n) }" /></em>
          }
          @case ('link') {
            <a
              [href]="hrefOf(n)"
              rel="noopener noreferrer"
              [attr.target]="isExternal(n) ? '_blank' : null"
              ><ng-container *ngTemplateOutlet="inl; context: { $implicit: childrenOf(n) }"
            /></a>
          }
        }
      }
    </ng-template>
    <ng-template #blk let-blocks>
      @for (b of asBlocks(blocks); track $index) {
        @switch (b.kind) {
          @case ('p') {
            <p><ng-container *ngTemplateOutlet="inl; context: { $implicit: inlinesOf(b) }" /></p>
          }
          @case ('h') {
            @if (levelOf(b) === 2) {
              <h2>
                <ng-container *ngTemplateOutlet="inl; context: { $implicit: inlinesOf(b) }" />
              </h2>
            } @else if (levelOf(b) === 3) {
              <h3>
                <ng-container *ngTemplateOutlet="inl; context: { $implicit: inlinesOf(b) }" />
              </h3>
            } @else {
              <h4>
                <ng-container *ngTemplateOutlet="inl; context: { $implicit: inlinesOf(b) }" />
              </h4>
            }
          }
          @case ('ul') {
            <ul>
              @for (item of itemsOf(b); track $index) {
                <li><ng-container *ngTemplateOutlet="inl; context: { $implicit: item }" /></li>
              }
            </ul>
          }
          @case ('ol') {
            <ol>
              @for (item of itemsOf(b); track $index) {
                <li><ng-container *ngTemplateOutlet="inl; context: { $implicit: item }" /></li>
              }
            </ol>
          }
          @case ('quote') {
            <blockquote>
              <ng-container *ngTemplateOutlet="blk; context: { $implicit: quoteOf(b) }" />
            </blockquote>
          }
        }
      }
    </ng-template>
    <ng-container *ngTemplateOutlet="blk; context: { $implicit: blocks() }" />
  `,
  styles: `
    :host {
      display: block;
      line-height: inherit;
    }
    h2,
    h3,
    h4 {
      margin-block: 1.4em 0.5em;
      line-height: 1.35;
    }
    h2 {
      font-size: 1.35rem;
    }
    h3 {
      font-size: 1.15rem;
    }
    h4 {
      font-size: 1rem;
    }
    p,
    ul,
    ol {
      margin-block: 0 1em;
    }
    ul,
    ol {
      padding-inline-start: 1.4em;
    }
    blockquote {
      margin: 0 0 1em;
      padding-inline-start: 1em;
      border-inline-start: 3px solid var(--c-border-2);
      color: var(--c-text-2);
    }
    a {
      color: var(--c-link);
    }
  `,
})
export class Markdown {
  readonly source = input<string | null>(null);
  protected readonly blocks = computed(() => parseMarkdown(this.source()));

  // Template helpers: narrow the union types for the template type-checker.
  protected asBlocks = (v: unknown) => v as Block[];
  protected asInlines = (v: unknown) => v as Inline[];
  protected textOf = (n: Inline) => (n.kind === 'text' ? n.text : '');
  protected childrenOf = (n: Inline) => (n.kind === 'text' ? [] : n.children);
  protected hrefOf = (n: Inline) => (n.kind === 'link' ? n.href : '');
  protected isExternal = (n: Inline) => n.kind === 'link' && n.external;
  protected inlinesOf = (b: Block) => (b.kind === 'p' || b.kind === 'h' ? b.inlines : []);
  protected levelOf = (b: Block) => (b.kind === 'h' ? b.level : 2);
  protected itemsOf = (b: Block) => (b.kind === 'ul' || b.kind === 'ol' ? b.items : []);
  protected quoteOf = (b: Block) => (b.kind === 'quote' ? b.blocks : []);
}
