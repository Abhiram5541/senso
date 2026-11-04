/* ---------------------------------------------------------------------------
 * Money arithmetic.
 *
 * Amounts are stored as `number`, which is an IEEE-754 double, and a double
 * cannot represent most decimal fractions exactly: 0.1 + 0.2 is
 * 0.30000000000000004. Summing a ledger therefore accumulates error, and a
 * campaign's paid total stops matching the rows it was added from — on the
 * one screen where a client checks what they were charged.
 *
 * Every published total goes through here, which keeps each one exact to the
 * minor unit. Two things this deliberately is not:
 *
 * - It is not integer minor units. That is the textbook fix and it is the
 *   right one eventually, but it changes the stored shape of every amount,
 *   every form that writes one and every surface that reads one, and it needs
 *   a migration of live rows. Rounding at the boundary removes the defect
 *   this file exists for at a fraction of the risk. Promote to minor units
 *   when an amount first needs to be split, multiplied by a rate, or
 *   reconciled against a payment processor — none of which happens yet.
 *
 * - It is not a fix for sub-minor-unit input. `Math.round(1.005 * 100)` is
 *   100, not 101, because 1.005 is really 1.00499999999999989. Amounts here
 *   arrive from a form as two decimal places, so `value * 100` sits within
 *   1e-10 of an integer and rounds correctly. An amount with three decimals
 *   would round unpredictably in the last place; reject it at the boundary
 *   rather than relying on this.
 *
 * Both helpers assume non-negative amounts, which the contracts enforce
 * (`z.number().nonnegative()`). `Math.round` breaks ties toward +∞, so -0.5
 * becomes -0 rather than -1; that asymmetry never arises while amounts
 * cannot be negative.
 * ------------------------------------------------------------------------ */

/** One money value, exact to the minor unit. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sums money values and rounds once, at the end.
 *
 * Rounding once rather than per addition is what keeps the total equal to the
 * sum a person gets adding the displayed rows: rounding each term first would
 * compound the rounding instead of the error.
 */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}
