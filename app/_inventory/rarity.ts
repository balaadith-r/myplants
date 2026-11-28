/**
 * Rarity tiers, lowest to highest. Their colours live in globals.css
 * (--rarity-*), next to the rest of the palette.
 */
export const RARITIES = ["abysmal", "common", "rare", "mythic", "legendary", "ultra-legendary"] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  abysmal: "Abysmal",
  common: "Common",
  rare: "Rare",
  mythic: "Mythic",
  legendary: "Legendary",
  "ultra-legendary": "Ultra Legendary",
};

/**
 * TEMPORARY placeholder odds (out of 100) until the real rarity system and the
 * live draw on the congrats page are in. Once there is a server, the roll must
 * happen there, or players could choose their own rarity.
 */
const ODDS: Record<Rarity, number> = {
  abysmal: 15,
  common: 45,
  rare: 25,
  mythic: 10,
  legendary: 4,
  "ultra-legendary": 1,
};

const TOTAL_ODDS = RARITIES.reduce((total, rarity) => total + ODDS[rarity], 0);

export function rollRarity(random = Math.random): Rarity {
  let roll = random() * TOTAL_ODDS;
  for (const rarity of RARITIES) {
    roll -= ODDS[rarity];
    if (roll < 0) return rarity;
  }
  return "common";
}

export function isRarity(value: unknown): value is Rarity {
  return typeof value === "string" && (RARITIES as readonly string[]).includes(value);
}

/** Higher is rarer. */
export function rarityRank(rarity: Rarity) {
  return RARITIES.indexOf(rarity);
}
