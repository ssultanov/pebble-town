# Pebble Town

A toy town kids can explore on an iPad. Swipe along the street, tap the hammer to build houses and shops,
and tap any building to go inside (the back arrow returns to town). The Honey Street House has four rooms
(kitchen, bedroom, bathroom, garden). There are four friends to dress up (tap the hat for skin tone, hair and
clothes), a cat and a dog, a toy box, and lots of things to tap. There are no ads, no
accounts, and no tracking. It works offline once installed.

## Play it

Open the site in Safari on the iPad, tap **Share**, then **Add to Home Screen**. Start it from the icon to
get full-screen play. The house saves automatically on that iPad.

## Develop

```bash
npm ci
npx playwright install chromium
npm run dev        # http://localhost:4173
npm run check      # static checks
npm test           # browser tests (iPad landscape)
```

To try changes on a real iPad, run `npm run dev` and open `http://<your-computer-ip>:4173` on the iPad
(same Wi‑Fi).

## Deploy

Every push to `main` runs the tests and then publishes to GitHub Pages
(`.github/workflows/ci.yml`). Pull requests run the tests only.

One-time setup: in the GitHub repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.

## Project guide

See [CLAUDE.md](CLAUDE.md) for how the game is structured, the save format, and the rules for changes.
