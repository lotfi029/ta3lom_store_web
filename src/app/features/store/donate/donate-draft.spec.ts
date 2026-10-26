import { OPEN_AMOUNT } from '../../../shared/ui/option-picker/option-picker';
import { type DonateProject, donateDraft, initialChoice } from './donate-draft';

const project = (over: Partial<DonateProject> = {}): DonateProject => ({
  id: 'p',
  slug: 'water',
  titleAr: 'سقيا',
  titleEn: 'Water',
  allowOpenAmount: true,
  minAmount: '10.00',
  options: [
    { id: 'o1', labelAr: 'بئر', labelEn: 'Well', amount: '500.00' },
    { id: 'o2', labelAr: 'خزان', labelEn: null, amount: '150.00' },
  ],
  ...over,
});

describe('donate box drafts (D-01)', () => {
  it('starts on the open amount only for an amount-only project', () => {
    expect(initialChoice(project({ options: [] }))).toBe(OPEN_AMOUNT);
    expect(initialChoice(project())).toBeNull();
    expect(initialChoice(project({ options: null }))).toBeNull();
  });

  it('an option × quantity line carries the option price and labels', () => {
    expect(donateDraft(project(), 'o2', 3, null)).toEqual({
      draft: {
        kind: 'option',
        projectId: 'p',
        optionId: 'o2',
        quantity: 3,
        unitAmount: '150.00',
        preview: {
          titleAr: 'سقيا',
          titleEn: 'Water',
          slug: 'water',
          optionLabelAr: 'خزان',
          optionLabelEn: null,
        },
      },
    });
  });

  it('an open amount needs a valid amount and a project that allows it', () => {
    expect(donateDraft(project(), OPEN_AMOUNT, 1, '75.00')).toEqual({
      draft: {
        kind: 'project',
        projectId: 'p',
        amount: '75.00',
        preview: { titleAr: 'سقيا', titleEn: 'Water', slug: 'water' },
      },
    });
    expect(donateDraft(project(), OPEN_AMOUNT, 1, null)).toEqual({ error: 'amount' });
    expect(donateDraft(project({ allowOpenAmount: false }), OPEN_AMOUNT, 1, '75.00')).toEqual({
      error: 'choose',
    });
  });

  it('nothing chosen, or an unknown option → choose first', () => {
    expect(donateDraft(project(), null, 1, null)).toEqual({ error: 'choose' });
    expect(donateDraft(project(), 'gone', 1, null)).toEqual({ error: 'choose' });
  });
});
