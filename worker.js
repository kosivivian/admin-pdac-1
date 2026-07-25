// Cloudflare Worker — proxies read-only Google Sheets API requests so API
// keys and spreadsheet IDs never ship to the browser or get committed to
// the repo. Extended from the leaderboard project's Worker to serve a
// second spreadsheet (this admin dashboard's automation-tracking sheet)
// from the same Worker, selected via a `sheet` query param.
//
// Deploy: Cloudflare dashboard -> Workers & Pages -> your existing Worker
// -> paste this file in as the Worker's code -> Deploy.
//
// Secrets (Settings -> Variables -> add, click "Encrypt" for both):
//   SHEET_ID              spreadsheet ID of "Dummy Summer Bootcamp
//                          Student Submission" (already set for the
//                          leaderboard — reused here as "bootcamp")
//   SHEET_ID_AUTOMATION   spreadsheet ID of "[PDAC] Daily posting
//                          Automation n8n sheet" (new)
//   SHEETS_API_KEY        same Google Sheets API key as before
//
// Both spreadsheets must be shared as "Anyone with the link — Viewer"
// (API-key auth has no user identity, so this is what makes them
// readable at all — same requirement as the leaderboard sheet already
// deployed under this Worker).
//
// Then set ALLOWED_ORIGIN below to your deployed page's origin, e.g.
// "https://yourusername.github.io" (scheme + host only, no path).

const ALLOWED_ORIGIN = "https://kosivivian.github.io";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// Maps the `sheet` query param to which secret holds that spreadsheet's ID.
const SHEET_IDS = {
  bootcamp: (env) => env.SHEET_ID,
  automation: (env) => env.SHEET_ID_AUTOMATION
};

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const range = url.searchParams.get("range");
    const sheet = url.searchParams.get("sheet") || "bootcamp";

    if (!range) {
      return new Response(JSON.stringify({ error: "Missing range query param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const getSheetId = SHEET_IDS[sheet];
    if (!getSheetId) {
      return new Response(JSON.stringify({ error: `Unknown sheet "${sheet}". Use "bootcamp" or "automation".` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const sheetsUrl =
      `${SHEETS_API}/${getSheetId(env)}/values/${encodeURIComponent(range)}?key=${env.SHEETS_API_KEY}`;
    const res = await fetch(sheetsUrl);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
