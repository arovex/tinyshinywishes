# ✨ Tiny Shiny Wishes

[![Live Preview](https://img.shields.io/badge/%E2%9C%A8%20Live%20Preview-Open%20the%20show-ff69b4?style=for-the-badge)](https://arovex.github.io/tinyshinywishes/)

A tiny, glittering birthday wish rendered with WebGL particles — no libraries, no build step.

Open `index.html` in a browser (or serve the folder) and watch the show:

- a spiral particle galaxy
- **HAPPY BIRTHDAY** spelled out in stardust
- a two-tier cake with three flickering candles
- a glowing heart with **MAKE A WISH**
- fireworks, embers, and drifting glitter throughout

The sequence loops on its own. Tap/click anywhere for fireworks, or press **Space** for a burst.

## Get the code

Clone the repo and step into it:

```bash
git clone https://github.com/arovex/tinyshinywishes.git
cd tinyshinywishes
```

Then open `index.html` — that's it.

## Run it

Just open `index.html`. For a local server:

```bash
npx serve .
```

Or see it live: **https://arovex.github.io/tinyshinywishes/**

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell, canvas, hint text |
| `birthday.js` | Particle engine and animation timeline |
| `LICENSE` | MIT license |

## Notes

Runs entirely in the browser on WebGL; the only requirement is JavaScript and WebGL enabled. Scales to fit desktop and mobile screens.

## License

Released under the [MIT License](LICENSE) © 2026 arovex. Use it, remix it, share it.

Made with a lot of tiny shiny things.
