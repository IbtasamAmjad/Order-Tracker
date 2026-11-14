// Which fields go on the tailor slip. Plain data only (no database), so the item builder in the browser can use it too.

/** Field types that never go on the tailor slip: pictures, text on the form, the automatic fields (dates!) and a builder group. */
const NEVER = new Set(["picture", "heading", "note", "customername", "ordernumber", "designnumber", "deliverydate", "group"]);

/** Can this kind of field be put on the tailor slip at all? */
export const slipEligible = (type: string) => !NEVER.has(type);

/**
 * For each field, whether it sits under a Measurements heading (a heading, or a builder group, whose name contains
 * "measure"). That is the default for "On tailor slip" when the office has not switched it.
 */
export function underMeasurements(fields: { type: string; label: string }[]): boolean[] {
  let inMeasure = false;
  return fields.map((f) => {
    if (f.type === "heading" || f.type === "group") {
      inMeasure = /measure/i.test(f.label);
      return false;
    }
    return inMeasure;
  });
}

/**
 * The fields without their "On tailor slip" switch: used to tell a real form change from a printout-only change, which
 * reaches customers in progress quietly (the master has nothing new to look at).
 */
export const withoutSlip = <T extends { slip?: boolean }>(fields: T[]) =>
  fields.map((f) => {
    const { slip, ...rest } = f;
    void slip;
    return rest;
  });

/** Is this field printed on the tailor slip? Its own switch wins; without one, it is when under a Measurements heading. */
export const onSlip = (f: { type: string; slip?: boolean }, under: boolean) => slipEligible(f.type) && (f.slip ?? under);
