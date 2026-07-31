/** Stable identifiers for each procedural Corporate HQ obstacle. */
export enum ObstacleTypeId {
  FILING_CABINET = 'FILING_CABINET',
  ARCHIVE_BOXES = 'ARCHIVE_BOXES',
  SECURITY_BARRIER = 'SECURITY_BARRIER',
  WET_FLOOR_CONE = 'WET_FLOOR_CONE',
  BROKEN_PRINTER = 'BROKEN_PRINTER',
}

/** How the player is expected to avoid an obstacle. */
export enum ObstacleBehavior {
  JUMP = 'JUMP',
  SLIDE = 'SLIDE',
}

export const ALL_OBSTACLE_TYPE_IDS: ReadonlyArray<ObstacleTypeId> = [
  ObstacleTypeId.FILING_CABINET,
  ObstacleTypeId.ARCHIVE_BOXES,
  ObstacleTypeId.WET_FLOOR_CONE,
  ObstacleTypeId.BROKEN_PRINTER,
  ObstacleTypeId.SECURITY_BARRIER,
];
