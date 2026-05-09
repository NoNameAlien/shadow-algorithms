import { describe, expect, it } from "vitest";
import {
  buildShadowSlotAssignments,
  getShadowSlotForLight,
  getShadowSlotLabels,
  selectShadowCasters,
} from "./shadows";

describe("shadow slot assignment", () => {
  it("assigns the first lights to available shadow slots", () => {
    expect(selectShadowCasters(3, 8)).toEqual([0, 1, 2]);
    expect(buildShadowSlotAssignments(3, 8)).toEqual([
      { lightIndex: 0, slotIndex: 0 },
      { lightIndex: 1, slotIndex: 1 },
      { lightIndex: 2, slotIndex: 2 },
    ]);
  });

  it("clamps caster selection by max slots and handles invalid counts", () => {
    expect(selectShadowCasters(10, 4)).toEqual([0, 1, 2, 3]);
    expect(selectShadowCasters(-2, 4)).toEqual([]);
  });

  it("returns labels for assigned and unassigned lights", () => {
    expect(getShadowSlotLabels(5, 3)).toEqual([0, 1, 2, null, null]);
  });

  it("looks up a light shadow slot from assignments", () => {
    const assignments = buildShadowSlotAssignments(2, 8);

    expect(getShadowSlotForLight(1, assignments)).toBe(1);
    expect(getShadowSlotForLight(3, assignments)).toBeNull();
  });
});
