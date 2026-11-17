import { PUBLISH_REQUIREMENTS, saveBarMessage } from './project-editor.page';
import { missingLabel } from './project-models';

describe('project editor layout (W-A3)', () => {
  it('names the dirty sections in the save bar', () => {
    expect(saveBarMessage(true, false)).toBe('تغييرات غير محفوظة في «التفاصيل»');
    expect(saveBarMessage(false, true)).toBe('تغييرات غير محفوظة في «خيارات التبرع»');
    expect(saveBarMessage(true, true)).toBe('تغييرات غير محفوظة في «التفاصيل» و«خيارات التبرع»');
  });

  it('lists every publish requirement the API can report, each with a label', () => {
    expect([...PUBLISH_REQUIREMENTS]).toEqual([
      'titleAr',
      'summaryAr',
      'bodyAr',
      'cover',
      'category',
      'amount',
    ]);
    for (const k of PUBLISH_REQUIREMENTS) expect(missingLabel(k)).not.toBe(k);
  });
});
