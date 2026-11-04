interface TurnIdentity {
  id: string;
}

export function snapshotContainsTurnIds(
  turns: TurnIdentity[],
  requiredTurnIds: Array<string | null | undefined>,
): boolean {
  const stableRequiredTurnIds = requiredTurnIds.filter(
    (turnId): turnId is string => Boolean(turnId),
  );

  if (stableRequiredTurnIds.length === 0) {
    return true;
  }

  const turnIds = new Set(turns.map((turn) => turn.id));
  return stableRequiredTurnIds.every((turnId) => turnIds.has(turnId));
}
