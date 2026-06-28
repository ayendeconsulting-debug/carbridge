import { describe, it, expect } from 'vitest';
import {
  computeLandedCost,
  toDisplay,
  serializeLandedCost,
  selectShippingCost,
} from './cost-engine';
import type { LandedCostInput, DisplayLine } from './types';

/** The SRD §8 worked example (2017 Ford Edge). */
const FORD: LandedCostInput = {
  purchasePriceCAD: '17900',
  shippingCostCAD: '1750', // RoRo
  clearingCostNGN: '2600000',
  fxRate: '1150',
};

const byKey = (lines: DisplayLine[]) =>
  Object.fromEntries(lines.map((l) => [l.key, l])) as Record<string, DisplayLine>;

describe('computeLandedCost — SRD §8 worked example', () => {
  const b = computeLandedCost(FORD);

  it('subtotal is (P+S)*r + C in naira', () => {
    expect(b.subtotal.ngn.toString()).toBe('25197500');
  });

  it('handling is 12% of the full subtotal', () => {
    expect(b.handling.ngn.toString()).toBe('3023700');
  });

  it('total is subtotal * 1.12', () => {
    expect(b.total.ngn.toString()).toBe('28221200');
  });

  it('renders the total to the kobo/cent', () => {
    const d = toDisplay(b);
    expect(d.total.ngn).toBe('₦28,221,200');
    expect(d.total.cad).toBe('$24,540.17');
  });

  it('renders every line in both currencies', () => {
    const l = byKey(toDisplay(b).lines);
    expect(l.purchase).toMatchObject({ cad: '$17,900.00', ngn: '₦20,585,000' });
    expect(l.shipping).toMatchObject({ cad: '$1,750.00', ngn: '₦2,012,500' });
    expect(l.clearing).toMatchObject({ cad: '$2,260.87', ngn: '₦2,600,000' });
    expect(l.handling).toMatchObject({
      label: 'Handling (12%)',
      cad: '$2,629.30',
      ngn: '₦3,023,700',
    });
    expect(l.total).toMatchObject({ cad: '$24,540.17', ngn: '₦28,221,200' });
  });
});

describe('shipping method changes the total', () => {
  const options = [
    { method: 'RORO' as const, costCAD: '1750' },
    { method: 'CONTAINER' as const, containerType: 'SOLE' as const, costCAD: '2400' },
  ];

  it('selects the chosen method cost', () => {
    expect(selectShippingCost(options, 'CONTAINER').toString()).toBe('2400');
    expect(selectShippingCost(options, 'RORO').toString()).toBe('1750');
  });

  it('reprices the landed total for a container', () => {
    const cost = selectShippingCost(options, 'CONTAINER');
    const b = computeLandedCost({ ...FORD, shippingCostCAD: cost });
    // (17900 + 2400) * 1150 + 2,600,000 = 25,945,000 subtotal
    expect(b.subtotal.ngn.toString()).toBe('25945000');
    // total = 25,945,000 * 1.12 = 29,058,400
    expect(b.total.ngn.toString()).toBe('29058400');
  });
});

describe('handling override (per-listing)', () => {
  it('applies a 10% rate and labels it', () => {
    const b = computeLandedCost({ ...FORD, handlingRate: '0.10' });
    expect(b.handling.ngn.toString()).toBe('2519750'); // 25,197,500 * 0.10
    expect(b.total.ngn.toString()).toBe('27717250');
    const handling = toDisplay(b).lines.find((l) => l.key === 'handling');
    expect(handling?.label).toBe('Handling (10%)');
  });
});

describe('live FX repricing', () => {
  it('CAD legs rise in naira as the rate rises; fixed clearing falls in CAD', () => {
    const lo = computeLandedCost({ ...FORD, fxRate: '1150' });
    const hi = computeLandedCost({ ...FORD, fxRate: '1250' });

    const loP = lo.lines.find((l) => l.key === 'purchase')!;
    const hiP = hi.lines.find((l) => l.key === 'purchase')!;
    expect(hiP.ngn.gt(loP.ngn)).toBe(true); // purchase costs more naira

    const loC = lo.lines.find((l) => l.key === 'clearing')!;
    const hiC = hi.lines.find((l) => l.key === 'clearing')!;
    expect(hiC.cad.lt(loC.cad)).toBe(true); // ₦-fixed clearing is fewer dollars

    expect(hi.total.ngn.gt(lo.total.ngn)).toBe(true);
  });
});

describe('no floating-point drift', () => {
  it('0.1 + 0.2 resolves to exactly 0.3', () => {
    const b = computeLandedCost({
      purchasePriceCAD: '0.1',
      shippingCostCAD: '0.2',
      clearingCostNGN: '0',
      fxRate: '1',
      handlingRate: '0',
    });
    expect(b.subtotal.cad.toString()).toBe('0.3'); // not 0.30000000000000004
  });
});

describe('serialization (authoritative stored figures)', () => {
  it('emits JSON-safe rounded strings', () => {
    const s = serializeLandedCost(computeLandedCost(FORD));
    expect(s.total).toEqual({ cad: '24540.17', ngn: '28221200' });
    expect(s.handlingRate).toBe('0.12');
    expect(typeof s.fxRate).toBe('string');
  });
});

describe('validation', () => {
  it('rejects a negative purchase price', () => {
    expect(() => computeLandedCost({ ...FORD, purchasePriceCAD: '-1' })).toThrow(
      /must not be negative/,
    );
  });
  it('rejects a non-positive FX rate', () => {
    expect(() => computeLandedCost({ ...FORD, fxRate: '0' })).toThrow(/positive/);
  });
  it('rejects a NaN input', () => {
    expect(() => computeLandedCost({ ...FORD, shippingCostCAD: Number.NaN })).toThrow(/finite/);
  });
});
