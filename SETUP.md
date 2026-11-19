# ABOVE Value List — setup

You need two free accounts: GitHub (hosts the site) and Cloudflare (runs the vote server).

## Part 1 — the website (GitHub Pages)

1. Go to github.com and sign in. Click the **+** (top right) → **New repository**.
   Name it `above-values`, set it to **Public**, tick **Add a README**, click **Create repository**.
2. On the repo page click **Add file → Upload files**. Drag in `index.html` and `values.json` from this folder. Click **Commit changes**.
3. Click **Settings** (repo tabs) → **Pages** (left menu). Under *Branch* choose **main** and **/ (root)**, click **Save**.
4. Wait about a minute, refresh. The page shows your link: `https://YOURNAME.github.io/above-values/`. That's the site.

Updating prices later: upload a new `values.json` the same way (step 2). Done.

## Part 2 — the vote server (Cloudflare Worker, free)

1. Go to dash.cloudflare.com and sign up (free plan). Skip adding a domain.
2. Left menu: **Storage & Databases → KV** → **Create a namespace**. Name it `above-votes`. Copy its **ID**.
3. Left menu: **Compute (Workers) → Create** → **Create Worker**. Name it `above-values-votes`, click **Deploy**.
4. Click **Edit code**. Delete everything in the editor, paste the whole contents of `worker/worker.js`, click **Deploy**.
5. Back on the worker page: **Settings → Bindings → Add → KV Namespace**.
   Variable name: `VOTES`   Namespace: `above-votes`. Save.
6. Still in Settings → **Variables and Secrets → Add**. Name `SALT`, value: any random words (e.g. `purple slime 9142`). Save & deploy.
7. Your worker URL is shown at the top, like `https://above-values-votes.YOURNAME.workers.dev`. Test it: open `THAT-URL/votes` in a browser; you should see `{}`.

## Part 3 — connect them

Open `index.html`, find the line near the top of the script:

    window.ABOVE_VOTE_API = window.ABOVE_VOTE_API || "";

and put the worker URL inside the quotes:

    window.ABOVE_VOTE_API = window.ABOVE_VOTE_API || "https://above-values-votes.YOURNAME.workers.dev";

Re-upload `index.html` to GitHub (Part 1 step 2). Votes are now live for everyone.

## How voting is protected
- One demand vote and one value vote per person per item per day (by IP). Re-voting the same day replaces your earlier vote instead of adding.
- Demand is the average of all votes; player value is the median of the last 400 votes so one troll can't drag it.
- Nothing personal is stored: IPs are hashed with your SALT and expire after 36 hours.

## Custom domain (optional, later)
Buy a domain (~$10/yr), then GitHub: Settings → Pages → Custom domain. Cloudflare can host the DNS for free.
