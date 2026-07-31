/**
 * Stable identifiers for each collectible type. Only one type (the Integrity Token) exists
 * in Sprint 2B, but the pool/factory/spawner are structured generically so a second type
 * could be added later without reshaping this architecture.
 */
export enum CollectibleTypeId {
  INTEGRITY_TOKEN = 'INTEGRITY_TOKEN',
}

export const ALL_COLLECTIBLE_TYPE_IDS: ReadonlyArray<CollectibleTypeId> = [
  CollectibleTypeId.INTEGRITY_TOKEN,
];
