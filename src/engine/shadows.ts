export const MAX_LIGHTS = 8;
export const MAX_SHADOW_SLOTS = 8;

export type ShadowSlotAssignment = {
  lightIndex: number;
  slotIndex: number;
};

export function selectShadowCasters(lightCount: number, maxSlots = MAX_SHADOW_SLOTS): number[] {
  const count = Math.max(0, Math.min(lightCount, maxSlots));
  return Array.from({ length: count }, (_, index) => index);
}

export function buildShadowSlotAssignments(lightCount: number, maxSlots = MAX_SHADOW_SLOTS): ShadowSlotAssignment[] {
  return selectShadowCasters(lightCount, maxSlots).map((lightIndex, slotIndex) => ({
    lightIndex,
    slotIndex,
  }));
}

export function getShadowSlotForLight(lightIndex: number, assignments: ShadowSlotAssignment[]): number | null {
  return assignments.find((assignment) => assignment.lightIndex === lightIndex)?.slotIndex ?? null;
}

export function getShadowSlotLabels(lightCount: number, maxSlots = MAX_SHADOW_SLOTS): Array<number | null> {
  const assignments = buildShadowSlotAssignments(lightCount, maxSlots);
  return Array.from({ length: Math.max(0, lightCount) }, (_, lightIndex) =>
    getShadowSlotForLight(lightIndex, assignments),
  );
}
