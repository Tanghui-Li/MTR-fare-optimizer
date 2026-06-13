import { describe, expect, it } from 'vitest';
import { getLineTextColor, lineColors } from './lineColors';

describe('getLineTextColor', () => {
  it('uses dark text on light line colors', () => {
    expect(getLineTextColor(lineColors.SIL)).toBe('#0f172a');
    expect(getLineTextColor(lineColors.DRL)).toBe('#0f172a');
  });

  it('uses dark text on Kwun Tong green for WCAG contrast', () => {
    expect(getLineTextColor(lineColors.KTL)).toBe('#0f172a');
  });

  it('uses white text on dark line colors', () => {
    expect(getLineTextColor(lineColors.TML)).toBe('#ffffff');
    expect(getLineTextColor(lineColors.TKL)).toBe('#ffffff');
  });
});
