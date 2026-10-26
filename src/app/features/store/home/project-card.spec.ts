import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProjectCard as Card } from '../../../core/api/api.types';
import { STORE_API_URL } from '../../../core/api/store-api-url';
import { ProjectCard } from './project-card';

const API = 'https://store-api.test/v1';
const tick = () => new Promise((r) => setTimeout(r));
const CARD: Card = {
  id: 'p1',
  slug: 'water-wells',
  titleAr: 'سقيا الماء',
  titleEn: 'Water wells',
  summaryAr: 'ملخص',
  summaryEn: null,
  coverUrl: 'https://store-api.test/files/w.webp',
  coverAltAr: 'بئر ماء',
  coverAltEn: 'A water well',
  badge: null,
  categorySlug: 'relief',
  allowOpenAmount: true,
  minAmount: '10.00',
  fromAmount: '250.00',
  options: [
    { id: 'o1', labelAr: 'نصف بئر', labelEn: 'Half a well', amount: '250.00' },
    { id: 'o2', labelAr: 'بئر', labelEn: 'A well', amount: '500.00' },
  ],
};

describe('ProjectCard (API-9, F-1)', () => {
  it('shows the options from the card itself — no /catalog/projects/{slug} request per card', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STORE_API_URL, useValue: API },
      ],
    });
    const fixture = TestBed.createComponent(ProjectCard);
    fixture.componentRef.setInput('project', CARD);
    fixture.detectChanges();
    TestBed.tick();
    await tick();
    fixture.detectChanges();
    TestBed.tick();
    await tick();
    const http = TestBed.inject(HttpTestingController);
    const urls = http.match(() => true).map((r) => r.request.url);
    expect(urls.filter((u) => u.startsWith(`${API}/catalog/projects/`))).toEqual([]);
    const el = fixture.nativeElement as HTMLElement;
    // two options + the open amount
    expect(el.querySelectorAll('ta-donate-box input[type=radio]')).toHaveLength(3);
    expect(el.querySelector('ta-donate-box')?.textContent).toContain('نصف بئر');
  });
});
