import { describe, expect, it } from "vitest";
import { roundMoney, sumMoney } from "./money";

/*
 * The property that matters on a ledger: the published total equals the sum a
 * person gets by adding the rows they can see. Raw `+` over doubles does not
 * guarantee that, which is the whole reason this module exists.
 */
describe("sumMoney", () => {
  it("totals a ledger exactly where plain addition does not", () => {
    const rows = [0.1, 0.2];
    expect(rows.reduce((total, value) => total + value, 0)).not.toBe(0.3); // the defect
    expect(sumMoney(rows)).toBe(0.3);
  });

  it("stays exact over a realistic run of invoice amounts", () => {
    const rows = Array.from({ length: 300 }, () => 1234.57);
    expect(sumMoney(rows)).toBe(370371);
    // Plain addition drifts away from the exact total.
    expect(rows.reduce((total, value) => total + value, 0)).not.toBe(370371);
  });

  it("rounds once at the end rather than per term", () => {
    // Three thirds of a rupee: rounding each term first would total 0.99.
    expect(sumMoney([0.333, 0.333, 0.334])).toBe(1);
  });

  it("is zero for an empty ledger, not NaN", () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe("roundMoney", () => {
  it("keeps a value at the minor unit", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1234.567)).toBe(1234.57);
    expect(roundMoney(500000)).toBe(500000);
  });

  it("makes a difference of two exact amounts exact again", () => {
    // What `outstanding` computes: committed minus paid.
    expect(0.3 - 0.1).not.toBe(0.2);
    expect(roundMoney(0.3 - 0.1)).toBe(0.2);
  });
});
