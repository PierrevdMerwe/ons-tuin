# ons tuin

A rose that was planted on the day we started dating and grows a little every day. On the first anniversary it blooms. Every year after that, more roses join it (2 new ones in year two, 3 in year three…), each year in its own colour, until it's a whole rose bush. Below the ground are the roots: every photo, note or song you plant grows its own root on the day it happened, and older roots branch out more over time.

- **Lock:** a password opens it. Everything in `garden/` is encrypted with that password, so the repo and site can be public (same idea as briefie).
- **Planting:** the green button adds photos, notes or songs straight from the site (phone or laptop). Each planting is a commit to this repo.
- **Nothing can be removed from the site.** Removing something means a code change (`node tuin.mjs remove`).
- **Decorations (✦):** switch on a fountain, a bench, a picket fence, string lights, butterflies, birds or Table Mountain in the distance. The choice is saved in the garden, so you both see the same thing.
- **Idea board (bulb):** both of you can post ideas for what to add next, and tick them off once they're built.
- **The anniversary letter:** "lees dit eerste" in the ⓘ panel (with a red dot until it's been read) unrolls a scroll with the letter and crayon drawings of the two of us. Tapping the underlined word sends a news ticker across the bottom.
- **Extras:** the sky follows the time of day (stars, moon and fireflies at night). A note can be a *saadjie* (seed) that stays closed until a date you pick. "Speel ons storie" in the ⓘ panel replays the whole growth. Tap a rose to see which year it's from.

Free hosting: GitHub Pages. No build step and no framework.

## 1. Put it on GitHub

```bash
git remote add origin git@github.com:<you>/ons-tuin.git
git push -u origin main
```

Then on GitHub, go to **Settings → Pages → Deploy from a branch → `main` / `(root)`** and save.

## 2. Give it a password and a key

The site plants things by committing to this repo, so it needs a GitHub key:

1. Open github.com/settings/personal-access-tokens/new (a fine-grained token).
2. Under **Repository access**, choose **Only select repositories → ons-tuin**.
3. Under **Permissions**, set **Contents → Read and write**.
4. Set the expiry to the longest allowed (a year). Renewing it each anniversary is fitting.

Then run:

```bash
node tuin.mjs setup
```

It asks for the day it all started, the password (twice) and the token. It checks that the token can write to the repo, then writes `garden/seed.json` (the salt, plus the start date and token sealed with the password) and an empty `garden/memories.bin`. Commit and push `garden/`.

- The start date lives only inside the sealed seed, so the public page and repo never show it. That matters when the password is the date itself.
- Capitals and extra spaces are ignored, and a date password can be typed any way: `15/03/2024`, `15 March 2024`, `2024-03-15` and `15032024` are all the same. (Day first: `03/04/2024` is 3 April.)
- Anyone who knows or guesses the password can see everything and plant things. Swapping to a phrase later means re-encrypting `garden/`; ask Claude.
- To renew the key, run `node tuin.mjs setup` again (the password stays). The ⓘ panel warns 30 days before it expires.

## 3. Plant the first year

Open the site, unlock it, tap the green button, and choose up to 5 photos for one memory, with one caption and date. The date fills in from the photo when the phone keeps it; otherwise pick it. Each photo is shrunk, encrypted in the browser, and committed. Pages takes a minute or two to redeploy, but the phone that planted sees it straight away.

## Looking after it

| | |
| --- | --- |
| Preview locally | `node dev.mjs` → http://localhost:8000 (planting there writes into `garden/` on your laptop; commit it, or undo with `git checkout garden/ && git clean -fd garden/`) |
| See another day | `?date=2028-06-01`, and `?hour=21` for night |
| List everything | `node tuin.mjs list` |
| Remove something | `node tuin.mjs remove <id>`, then commit and push |
| Back everything up | `node tuin.mjs export` (decrypts into `private/export/`, which is gitignored) |
| Wording | `words.js`, plus the ⓘ text in `index.html` |
| Names | `data-gardeners`, `data-for` on `<body>` in `index.html` (the start date is set by `tuin.mjs setup`) |
| Rose colours per year | `PALETTES` in `garden.js` |
| Bulk planting | list memories in `private/memories.json`, drop photos in `private/photos/<id>/` (up to 5 each, any format including HEIC), then `git pull`, `node tuin.mjs plant`, and commit and push `garden/`. An entry without photos shows as a small card until they arrive. Safe to re-run |
| The letter | edit `private/letter.txt` (gitignored), run `node tuin.mjs letter`, then commit and push `garden/letter.bin`. In the text: `# greeting`, `~ sign-off`, `{vis}` for a drawing from `doodles.js`, `[word|ticker text]`, and `<3` for a heart |
| A new decoration | draw it in `garden.js` (next to `drawFountain`, then add it to `drawBackdrop`) and list it in `DECOR` in `words.js` |

After changing any code, bump `VERSION` (the `v=` number, in two places near the top of `index.html`), so phones pick up the change on the next refresh.

Before sending the link, run `git status` and check that `private/` never shows up.
