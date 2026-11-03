// Poster Town pricing rules: shipping, the A4 bundle and coupons. This file is kept
// identical in postertown_web and postertown_backend (src/utils/pricing.js): the
// storefront uses it to show the totals, the backend to recalculate them for every
// order. Change both copies together.

export const SHIPPING_FEE = 100;
// Shipping is free once the cart holds this many posters (any sizes).
export const FREE_SHIPPING_MIN_ITEMS = 2;
// Any 3 A4 posters for ₹1599.
export const A4_BUNDLE_SIZE = 3;
export const A4_BUNDLE_PRICE = 1599;

const DEMON_SLAYER =
  /demon slayer|kimetsu|tanjiro|nezuko|zenitsu|inosuke|giyu|rengoku|akaza|muzan|shinobu|tengen|sanemi|muichiro|mitsuri|obanai|gyomei|kanao|douma|kokushibo/i;

// Some Demon Slayer posters are filed under the character's name rather than the
// series, so the character names count too.
export const isDemonSlayer = (subCategory = "", name = "") => DEMON_SLAYER.test(`${subCategory} ${name}`);

export const COUPONS = {
  DEMON200: {
    amount: 200,
    description: "₹200 off a Demon Slayer poster in A3",
    requirement: "DEMON200 works when your cart has a Demon Slayer poster in A3 (Medium) size.",
    appliesTo: (line) => line.paper === "A3" && line.demonSlayer,
  },
};

export const normalizeCouponCode = (code = "") => String(code).trim().toUpperCase();

// lines: [{ unitPrice, quantity, paper: "A4" | "A3" | ..., demonSlayer: boolean }]
export function priceCart(lines = [], couponCode = "") {
  const items = lines
    .map((line) => ({
      ...line,
      unitPrice: Math.max(0, Math.round(Number(line.unitPrice) || 0)),
      quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
    }))
    .filter((line) => line.quantity > 0);

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const productsTotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  // A4 bundle: group the A4 posters in threes, priciest first so the customer saves
  // the most. A group only counts when it would actually cost less.
  const a4Prices = items
    .filter((line) => line.paper === "A4")
    .flatMap((line) => Array(line.quantity).fill(line.unitPrice))
    .sort((a, b) => b - a);
  let bundles = 0;
  let bundleDiscount = 0;
  for (let start = 0; start + A4_BUNDLE_SIZE <= a4Prices.length; start += A4_BUNDLE_SIZE) {
    const groupTotal = a4Prices.slice(start, start + A4_BUNDLE_SIZE).reduce((sum, price) => sum + price, 0);
    if (groupTotal > A4_BUNDLE_PRICE) {
      bundles += 1;
      bundleDiscount += groupTotal - A4_BUNDLE_PRICE;
    }
  }

  // Coupon: applied once per order, never more than the posters it covers cost.
  const code = normalizeCouponCode(couponCode);
  const coupon = code ? COUPONS[code] : null;
  let couponDiscount = 0;
  let couponError = "";
  if (code && !coupon) {
    couponError = "That coupon code isn't valid.";
  } else if (coupon) {
    const eligibleTotal = items
      .filter(coupon.appliesTo)
      .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (eligibleTotal > 0) {
      couponDiscount = Math.min(coupon.amount, eligibleTotal);
    } else {
      couponError = coupon.requirement;
    }
  }

  const subtotal = productsTotal - bundleDiscount - couponDiscount;
  const shipping = itemCount === 0 || itemCount >= FREE_SHIPPING_MIN_ITEMS ? 0 : SHIPPING_FEE;
  const a4Short = a4Prices.length % A4_BUNDLE_SIZE;

  return {
    itemCount,
    productsTotal,
    bundles,
    bundleDiscount,
    couponCode: couponDiscount > 0 ? code : "",
    couponDiscount,
    couponError,
    subtotal,
    shipping,
    total: subtotal + shipping,
    // How many more posters unlock free shipping / complete the next A4 bundle.
    itemsToFreeShipping: shipping > 0 ? FREE_SHIPPING_MIN_ITEMS - itemCount : 0,
    a4ToNextBundle: a4Short ? A4_BUNDLE_SIZE - a4Short : a4Prices.length ? 0 : A4_BUNDLE_SIZE,
  };
}
