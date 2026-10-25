import type { Category } from '../../../core/api/api.types';
import { giftCategories } from './quick-donate.data';

const cat = (slug: string, acceptsGeneralGifts: boolean): Category => ({
  id: slug,
  slug,
  nameAr: slug,
  nameEn: null,
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  imageAltAr: null,
  acceptsGeneralGifts,
  projectCount: 1,
});

describe('quick donate (M-5)', () => {
  it('offers only the categories that accept general gifts, in the API order', () => {
    expect(
      giftCategories([cat('b', true), cat('a', false), cat('c', true)]).map((c) => c.slug),
    ).toEqual(['b', 'c']);
  });
});
