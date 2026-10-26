import { HttpErrorResponse } from '@angular/common/http';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AdminProject, ProjectOptionsInput } from '../../../core/api/api.types';
import { CatalogAdminData } from './catalog-admin.data';
import { OptionsEditor } from './options-editor';

const OPT = { id: 'o1', labelAr: 'سهم', labelEn: null, amount: '50.00', sort: 0, isActive: true };
const project = (version: number, options = [OPT]): AdminProject =>
  ({ id: 'p1', version, options }) as unknown as AdminProject;

/** R-1 / F-2: the editor keeps its own base version; a details save must not wipe unsaved option edits. */
describe('OptionsEditor base version (F-2, R-1)', () => {
  let sent: ProjectOptionsInput[];
  let reply: () => Promise<AdminProject>;

  function mount() {
    sent = [];
    reply = () => Promise.resolve(project(9));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: LOCALE_ID, useValue: 'ar' },
        {
          provide: CatalogAdminData,
          useValue: {
            saveOptions: (_id: string, body: ProjectOptionsInput) => {
              sent.push(body);
              return reply();
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(OptionsEditor);
    fixture.componentRef.setInput('project', project(1));
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const label = () => el.querySelector<HTMLInputElement>('#op-ar-o1')!;
    const edit = (v: string) => {
      label().value = v;
      label().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const setProject = (p: AdminProject) => {
      fixture.componentRef.setInput('project', p);
      fixture.detectChanges();
    };
    const save = async () => {
      el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    };
    return { fixture, label, edit, setProject, save };
  }

  it('same options, newer version (a details save): unsaved rows kept, the save sends the new version', async () => {
    const { label, edit, setProject, save } = mount();
    edit('سهم كامل');
    setProject(project(2));
    expect(label().value).toBe('سهم كامل');
    await save();
    expect(sent[0].version).toBe(2);
    expect(sent[0].options[0].labelAr).toBe('سهم كامل');
  });

  it('different options while clean: rows and base version reset to the new project', async () => {
    const { label, setProject, save, edit } = mount();
    setProject(project(3, [{ ...OPT, labelAr: 'سهم جديد' }]));
    expect(label().value).toBe('سهم جديد');
    edit('سهم معدل');
    await save();
    expect(sent[0].version).toBe(3);
  });

  it('different options while dirty: rows kept, base version NOT advanced → 409 → conflict, no silent overwrite', async () => {
    const { fixture, label, edit, setProject, save } = mount();
    let conflicts = 0;
    fixture.componentInstance.conflict.subscribe(() => conflicts++);
    edit('سهم كامل');
    setProject(project(4, [{ ...OPT, labelAr: 'غيّره شخص آخر' }]));
    expect(label().value).toBe('سهم كامل');
    reply = () =>
      Promise.reject(
        new HttpErrorResponse({
          status: 409,
          error: { status: 409, code: 'concurrency.conflict' },
        }),
      );
    await save();
    expect(sent[0].version).toBe(1);
    expect(conflicts).toBe(1);
  });
});
