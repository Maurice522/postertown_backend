// Sends GA4 events from the server with the Measurement Protocol, for things that
// happen after the shopper has left the site (refunds decided in the admin console).
// Needs GA4_MEASUREMENT_ID and GA4_API_SECRET (GA4 → Admin → Data streams → the web
// stream → Measurement Protocol API secrets); without them nothing is sent.
const MP_URL = "https://www.google-analytics.com/mp/collect";

export async function sendGaRefund(order) {
  const { GA4_MEASUREMENT_ID: id, GA4_API_SECRET: secret } = process.env;
  if (!id || !secret) return;

  const body = {
    // Same client id as the purchase; orders from before it was saved get a stable
    // stand-in per order.
    client_id: order.analytics?.gaClientId || `order.${order.id}`,
    events: [
      {
        name: "refund",
        params: {
          currency: "INR",
          transaction_id: order.id,
          value: Number(order.totals?.total) || 0,
        },
      },
    ],
  };

  try {
    const res = await fetch(`${MP_URL}?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`[ga] refund event for ${order.id} failed with ${res.status}`);
  } catch (error) {
    console.error(`[ga] refund event for ${order.id} failed`, error);
  }
}
