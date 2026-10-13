import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it('renders sub-KB sizes as whole bytes', () => {
    expect(formatBytes(840)).toBe('840 B');
    expect(formatBytes(0)).toBe('0 B');
  });

  it('renders KB with one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('renders MB with one decimal place', () => {
    expect(formatBytes(1_258_291)).toBe('1.2 MB');
  });

  it('renders GB for sizes that exceed a thousand MB', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });

  it('stops at GB rather than inventing a TB unit', () => {
    expect(formatBytes(5 * 1024 * 1024 * 1024 * 1024)).toBe('5120.0 GB');
  });
});
