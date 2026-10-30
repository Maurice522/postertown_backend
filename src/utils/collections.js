// The storefront collections a product can belong to. Products store the slugs in
// product.collections. Keep the slugs in step with postertown_web/src/data/collections.js,
// which holds each collection's page copy.
//
// A product joins a collection when:
// - its category is listed in `categories`, or
// - a keyword appears as a whole word in its name, series or characters, or
// - Gemini picked it (needed for judgement calls like "villains").
export const COLLECTION_CATALOG = [
  {
    slug: "demon-slayer",
    title: "Demon Slayer",
    keywords: ["demon slayer", "kimetsu", "tanjiro", "nezuko", "giyu", "rengoku", "inosuke", "zenitsu", "shinobu", "sanemi", "muzan", "akaza", "tengen", "mitsuri"]
  },
  {
    slug: "dragon-ball-z",
    title: "Dragon Ball Z",
    keywords: ["dragon ball", "goku", "vegeta", "broly", "frieza", "freeza", "gohan", "majin buu", "piccolo", "trunks", "beerus", "jiren"]
  },
  {
    slug: "naruto",
    title: "Naruto",
    keywords: ["naruto", "sasuke", "itachi", "kakashi", "madara", "obito", "jiraiya", "minato", "boruto"]
  },
  {
    slug: "one-piece",
    title: "One Piece",
    keywords: ["one piece", "luffy", "zoro", "sanji", "shanks", "portgas d. ace", "nami", "trafalgar law", "whitebeard", "kaido"]
  },
  {
    slug: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    keywords: ["jujutsu kaisen", "gojo", "sukuna", "itadori", "yuji", "megumi", "nobara", "toji", "geto"]
  },
  {
    slug: "solo-leveling",
    title: "Solo Leveling",
    keywords: ["solo leveling", "sung jinwoo", "jinwoo", "igris", "beru"]
  },
  {
    slug: "superheroes",
    title: "Superheroes",
    categories: ["DC", "Marvel"],
    keywords: ["batman", "superman", "spider-man", "spiderman", "iron man", "captain america", "thor", "hulk", "wonder woman", "flash", "deadpool", "wolverine", "black panther", "doctor strange"],
    hint: "heroes and anti-heroes from DC, Marvel or other comics"
  },
  {
    slug: "villains",
    title: "Villains",
    keywords: ["joker", "thanos", "darth vader", "frieza", "freeza", "sukuna", "muzan", "madara", "venom", "loki", "bane", "harley quinn", "akaza"],
    hint: "the main subject is a villain, e.g. Joker, Thanos, Darth Vader, Frieza, Sukuna, Muzan, Madara"
  },
  {
    slug: "call-of-duty",
    title: "Call of Duty",
    keywords: ["call of duty", "modern warfare", "warzone", "black ops", "simon riley", "captain price", "soap mactavish"],
    hint: "Call of Duty games and operators such as Ghost or Captain Price"
  },
  {
    slug: "gaming",
    title: "Gaming",
    categories: ["Games"]
  },
  {
    slug: "anime",
    title: "Anime",
    categories: ["Anime"]
  },
  {
    slug: "movies",
    title: "Movies",
    categories: ["Movie"]
  },
  {
    slug: "cars",
    title: "Cars",
    categories: ["Car"],
    keywords: ["porsche", "ferrari", "lamborghini", "bmw", "mercedes", "nissan gt-r", "supra", "mustang", "mclaren", "bugatti"]
  }
];

export const COLLECTION_SLUGS = COLLECTION_CATALOG.map((collection) => collection.slug);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word match so e.g. "Rengoku" never counts as "Goku".
function mentions(text, keyword) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}($|[^a-z0-9])`, "i").test(text);
}

function productText(product = {}) {
  return [
    product.name,
    product.category?.subCategory,
    product.filterableAttributes?.animeSeries,
    product.filterableAttributes?.character,
    ...(product.filters?.character || [])
  ]
    .filter(Boolean)
    .join(" | ");
}

// Collections a product belongs to by the rules alone.
export function ruleCollections(product = {}) {
  const category = product.category?.main || product.category;
  const text = productText(product);

  return COLLECTION_CATALOG.filter(
    (collection) =>
      collection.categories?.includes(category) ||
      collection.keywords?.some((keyword) => mentions(text, keyword))
  ).map((collection) => collection.slug);
}

// Rule matches plus any valid extra picks (from Gemini or the admin), in catalog order.
export function assignCollections(product = {}, extraSlugs = []) {
  const picked = new Set([
    ...ruleCollections(product),
    ...(Array.isArray(extraSlugs) ? extraSlugs : []).filter((slug) => COLLECTION_SLUGS.includes(slug))
  ]);
  return COLLECTION_SLUGS.filter((slug) => picked.has(slug));
}

// Only valid slugs, de-duplicated, in catalog order.
export function sanitizeCollections(slugs) {
  const wanted = new Set(Array.isArray(slugs) ? slugs : []);
  return COLLECTION_SLUGS.filter((slug) => wanted.has(slug));
}
