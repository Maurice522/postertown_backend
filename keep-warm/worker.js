// Pings the API every 5 minutes so Render's free plan never puts it to sleep (a
// sleeping API makes the next visitor wait ~25 seconds). GitHub's scheduled
// workflow does the same job but often doesn't fire for hours; Cloudflare's cron
// triggers run on time.
const API_URL = "https://postertown-backend-v2.onrender.com/";

export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(
      fetch(API_URL, { signal: AbortSignal.timeout(60000) }).then(
        (res) => console.log(`API ping: ${res.status}`),
        (error) => console.log(`API ping failed: ${error.message}`)
      )
    );
  },
};
