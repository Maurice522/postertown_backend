const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";

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

export async function createProductDraftFromImage({ imageBuffer, mimeType, media }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to generate product drafts");
  }

  const prompt = `
You are creating a Poster Town ecommerce product draft from a poster image.
Return only valid JSON. Do not include markdown.

Rules:
- The product is usually a metal wall poster.
- Infer the subject, character, anime/movie/game/theme, category, SEO, filters, specifications, badges, and descriptive copy from the image.
- Do not generate a product id.
- Do not invent pricing, discount, size prices, inventory, ratings, reviews, metrics, or user state.
- Keep arrays concise and useful for ecommerce filtering.
- Use this exact shape and fill only suitable content:
{
  "sku": "",
  "slug": "",
  "name": "",
  "subtitle": "",
  "brand": "Poster Town",
  "vendor": "Poster Town",
  "category": { "main": "", "subCategory": "", "collection": "" },
  "description": { "short": "", "full": "", "features": [] },
  "media": { "featuredImage": "", "thumbnail": "", "gallery": [], "video": "" },
  "specifications": {
    "material": "Galvanized Metal",
    "finish": "Matte",
    "orientation": "",
    "shape": "Rectangle",
    "thickness": "1.2mm",
    "weight": "450g",
    "mountType": "Magnetic"
  },
  "productAttributes": {
    "waterproof": true,
    "rustResistant": true,
    "scratchResistant": true,
    "fadeResistant": true
  },
  "filterableAttributes": {
    "animeSeries": "",
    "character": "",
    "theme": "",
    "material": "Metal",
    "orientation": ""
  },
  "filters": {
    "theme": [],
    "character": [],
    "colorPalette": [],
    "roomType": [],
    "style": []
  },
  "badges": [],
  "shipping": {
    "freeShipping": true,
    "estimatedDelivery": "3-7 days",
    "dispatchTime": "24-48 hours",
    "codAvailable": true
  },
  "careInstructions": [],
  "seo": { "metaTitle": "", "metaDescription": "", "keywords": [] },
  "crossSell": { "relatedProducts": [], "frequentlyBoughtTogether": [] },
  "flags": { "featured": false, "newArrival": true, "exclusive": false },
  "compliance": { "hsnCode": "49119100", "taxClass": "GST18" }
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: imageBuffer.toString("base64")
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || "Gemini request failed");
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini did not return product content");
  }

  const draft = extractJson(text);

  return {
    ...draft,
    media: {
      ...(draft.media || {}),
      featuredImage: media.url,
      thumbnail: media.url,
      gallery: [media.url],
      cloudinary: [media.cloudinary],
      video: draft.media?.video || ""
    }
  };
}
