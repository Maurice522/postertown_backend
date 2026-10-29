const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";
const GEMINI_TIMEOUT_MS = 60_000;

// Values that describe Poster Town's physical product, not the artwork. They are set
// here instead of being echoed back by the model so every draft gets the same values.
const PRODUCT_DEFAULTS = {
  brand: "Poster Town",
  vendor: "Poster Town",
  specifications: {
    material: "Galvanized Metal",
    finish: "Matte",
    shape: "Rectangle",
    thickness: "1 mm",
    weight: "450g",
    mountType: "Magnetic"
  },
  productAttributes: {
    waterproof: true,
    rustResistant: true,
    scratchResistant: true,
    fadeResistant: true
  },
  shipping: {
    freeShipping: true,
    estimatedDelivery: "3-7 days",
    dispatchTime: "24-48 hours",
    codAvailable: true
  },
  careInstructions: [
    "Wipe gently with a soft, dry cloth",
    "Avoid harsh chemicals and abrasive cleaners",
    "Keep away from prolonged direct moisture"
  ],
  badges: ["New"],
  crossSell: { relatedProducts: [], frequentlyBoughtTogether: [] },
  flags: { featured: false, newArrival: true, exclusive: false },
  compliance: { hsnCode: "49119100", taxClass: "GST18" }
};

// Kept in line with the categories already used by the storefront catalog.
const CATEGORIES = ["Anime", "DC", "Marvel", "Movie", "TV Series", "Games", "Car", "Sports", "Music", "Art"];
const COLLECTIONS = {
  Anime: "Anime Metal Prints",
  DC: "DC Metal Prints",
  Marvel: "Marvel Metal Prints",
  Movie: "Movie Metal Prints",
  "TV Series": "TV Series Metal Prints",
  Games: "Gaming Metal Prints",
  Car: "Car Metal Prints",
  Sports: "Sports Metal Prints",
  Music: "Music Metal Prints",
  Art: "Art Metal Prints"
};
const COLORS = ["Black", "White", "Grey", "Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple", "Pink", "Brown", "Gold", "Silver"];
const ROOM_TYPES = ["Bedroom", "Gaming Setup", "Living Room", "Entertainment Wall", "Office", "Kids Room"];
const STYLES = ["Anime", "Comic", "Cinematic", "Minimal", "Neon", "Dark", "Vintage", "Fantasy", "Sci-Fi", "Cyberpunk", "Realistic", "Typography", "Abstract"];

const stringArray = (extra = {}) => ({ type: "ARRAY", items: { type: "STRING", ...extra } });

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    subtitle: { type: "STRING" },
    category: { type: "STRING", enum: CATEGORIES },
    series: { type: "STRING" },
    character: { type: "STRING" },
    orientation: { type: "STRING", enum: ["Portrait", "Landscape"] },
    shortDescription: { type: "STRING" },
    fullDescription: { type: "STRING" },
    features: stringArray(),
    themes: stringArray(),
    characters: stringArray(),
    colorPalette: stringArray({ enum: COLORS }),
    roomType: stringArray({ enum: ROOM_TYPES }),
    style: stringArray({ enum: STYLES }),
    metaTitle: { type: "STRING" },
    metaDescription: { type: "STRING" },
    keywords: stringArray()
  },
  required: [
    "name", "subtitle", "category", "series", "character", "orientation", "shortDescription",
    "fullDescription", "features", "themes", "characters", "colorPalette", "roomType", "style",
    "metaTitle", "metaDescription", "keywords"
  ],
  propertyOrdering: [
    "category", "series", "character", "orientation", "name", "subtitle", "shortDescription",
    "fullDescription", "features", "themes", "characters", "colorPalette", "roomType", "style",
    "metaTitle", "metaDescription", "keywords"
  ]
};

function buildPrompt(vocabulary = {}) {
  const known = (label, values) => (values?.length ? `- Existing ${label} in the catalog (reuse the exact spelling when it matches): ${values.join("; ")}\n` : "");

  return `
You write product listings for Poster Town, an Indian store selling posters printed on 1 mm galvanized metal sheets.
Look at the poster artwork and fill the JSON schema.

Rules:
- Identify the franchise and character from the artwork. If you are not sure, use a descriptive name instead of guessing (e.g. "Samurai in Moonlight").
- series: the franchise's common short English title, e.g. "Demon Slayer", "One Piece", "Naruto", "Batman". Empty string if none.
- character: the main character's best-known full name, e.g. "Shinobu Kocho", "Monkey D. Luffy". Empty string if none.
- Only mention a transformation, form or arc (e.g. "Gear 5") when it is unmistakable in the artwork.
- name: "<Character or Subject> <short visual hook> Metal Poster", at most 60 characters. No colons.
- subtitle: one short tagline, at most 70 characters.
- shortDescription: one sentence, at most 160 characters.
- fullDescription: 2-3 short paragraphs separated by a blank line: the artwork first, then the metal print quality.
- features: exactly 5 bullet points; first two about the artwork, last three about the metal print.
- themes: 2-4 single-word or two-word themes about mood or subject; do not repeat the series or character name. characters: every recognisable character, best-known names.
- colorPalette: 3-5 dominant colours. roomType: 1-3 entries. style: 1-3 entries.
- metaTitle at most 60 characters. metaDescription 120-155 characters. keywords: 8-10 search phrases.
- Never call the poster "official", "licensed" or "authentic", and never claim endorsement by any studio or brand.
- Do not mention prices, discounts, sizes, stock, ratings or reviews.
${known("series", vocabulary.series)}${known("characters", vocabulary.characters)}`.trim();
}

const UNSUPPORTED_CLAIMS = /\b(officially|official|licensed|authentic|genuine)\b\s*/gi;

function clean(value, maxLength) {
  const text = String(value ?? "")
    .replace(UNSUPPORTED_CLAIMS, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!maxLength || text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : maxLength).replace(/[\s,;:.-]+$/, "");
}

function cleanList(values, { max, allowed } = {}) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = clean(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || (allowed && !allowed.includes(text))) continue;
    seen.add(key);
    result.push(text);
  }
  return max ? result.slice(0, max) : result;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Gemini did not return a JSON object");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

async function callGemini(body) {
  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;

  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) return data;

    // 500/503 are usually a temporarily overloaded model; one retry fixes most of them.
    if (attempt < 2 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    const error = new Error(
      response.status === 429
        ? "Gemini quota or rate limit reached. Try again in a minute, or check the API plan."
        : data?.error?.message || "Gemini request failed"
    );
    error.status = response.status;
    throw error;
  }
}

// Turns the model's flat answer into the product shape the admin client and
// storefront use.
export function buildProductDraft(ai, media) {
  const category = CATEGORIES.includes(ai.category) ? ai.category : "Art";
  const orientation = ai.orientation === "Landscape" ? "Landscape" : "Portrait";
  const series = clean(ai.series, 60);
  const character = clean(ai.character, 60);
  const name = clean(ai.name, 60).replace(/:/g, "") || clean(`${character || series || "Poster Town"} Metal Poster`, 60);
  // Series and character have their own filters, so keep them out of themes.
  const nameKeys = [series, character].map((value) => value.toLowerCase());
  const themes = cleanList(ai.themes).filter((theme) => !nameKeys.includes(theme.toLowerCase())).slice(0, 4);

  return {
    sku: "",
    slug: slugify(name),
    name,
    subtitle: clean(ai.subtitle, 70),
    brand: PRODUCT_DEFAULTS.brand,
    vendor: PRODUCT_DEFAULTS.vendor,
    category: {
      main: category,
      subCategory: series || character || category,
      collection: COLLECTIONS[category]
    },
    description: {
      short: clean(ai.shortDescription, 160),
      full: clean(ai.fullDescription),
      features: cleanList(ai.features, { max: 5 })
    },
    media: {
      featuredImage: media.url,
      thumbnail: media.url,
      gallery: [media.url],
      cloudinary: [media.cloudinary],
      video: ""
    },
    specifications: { ...PRODUCT_DEFAULTS.specifications, orientation },
    productAttributes: { ...PRODUCT_DEFAULTS.productAttributes },
    filterableAttributes: {
      animeSeries: series,
      character,
      theme: themes[0] || category,
      material: "Metal",
      orientation
    },
    filters: {
      theme: themes,
      character: cleanList(ai.characters?.length ? ai.characters : [character], { max: 6 }),
      colorPalette: cleanList(ai.colorPalette, { max: 5, allowed: COLORS }),
      roomType: cleanList(ai.roomType, { max: 3, allowed: ROOM_TYPES }),
      style: cleanList(ai.style, { max: 3, allowed: STYLES })
    },
    badges: [...PRODUCT_DEFAULTS.badges],
    shipping: { ...PRODUCT_DEFAULTS.shipping },
    careInstructions: [...PRODUCT_DEFAULTS.careInstructions],
    seo: {
      metaTitle: clean(ai.metaTitle, 60),
      metaDescription: clean(ai.metaDescription, 160),
      keywords: cleanList(ai.keywords, { max: 10 })
    },
    crossSell: structuredClone(PRODUCT_DEFAULTS.crossSell),
    flags: { ...PRODUCT_DEFAULTS.flags },
    compliance: { ...PRODUCT_DEFAULTS.compliance }
  };
}

// Asks Gemini to describe the artwork. Returns the model's flat answer; combine it with
// the uploaded image using buildProductDraft.
export async function describePosterImage({ imageBuffer, mimeType, vocabulary }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to generate product drafts");
  }

  const data = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(vocabulary) },
          { inlineData: { mimeType, data: imageBuffer.toString("base64") } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA
    }
  });

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini returned no content (${reason})` : "Gemini did not return product content");
  }

  return extractJson(text);
}

export async function createProductDraftFromImage({ imageBuffer, mimeType, media, vocabulary }) {
  const ai = await describePosterImage({ imageBuffer, mimeType, vocabulary });
  return buildProductDraft(ai, media);
}
