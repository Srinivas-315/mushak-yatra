# 🐭 Mushak Yatra — The Road to Bappa

A 3D Ganesh Chaturthi festival runner that plays in any browser, on phones and laptops.

You are **Mushak**, Lord Ganesha's loyal mouse. Race through the festival, collect modaks and
offerings, and reach the shore in time for the aarti.

> 🙏 Ganpati Bappa Morya!

---

## ▶️ Play

- **▶️ Play now: https://srinivas-315.github.io/mushak-yatra/**
- **Run locally:** see "Running it yourself"

Works in Chrome, Edge, Firefox and Safari, on Android, iPhone, laptop and desktop.
Nothing to install, no sign-in, and the game collects **no personal data**
(your best score is stored only in your own browser).

## 🎮 How to play

| Action | Phone | Laptop |
|---|---|---|
| Change lane | Swipe left / right | ← → or A / D |
| Jump | Swipe up (or tap) | ↑ / W / Space |
| Slide | Swipe down | ↓ / S |
| Pause | Pause button | Esc or P |
| Start / Restart | Tap the button | Enter |

**Goal:** survive 3 acts and reach the shrine. You have **3 diyas** (lives). Bumping an
obstacle blows one out, and a new act relights one.

### Things to collect
| | | |
|---|---|---|
| 🟠 **Modak** | +10 points | 21 of them triggers Vighnaharta Mode |
| 🌿 **Durva** / 🌺 **Flower** | +25 points | fills the Puja meter |
| 🪔 **Diya** | +1 life | or +100 points if you're already full |
| ✨ **Rangoli** | +50 points | lights up as you run across it |
| 🌱 **Clay gate** | +150 points | choose clay, avoid the plastic gate |

### The three special mechanics
1. **🪷 Vighnaharta Mode** — collect **21 modaks** (the traditional offering) and Mushak glows
   gold for 5 seconds. Every obstacle ahead turns into marigold petals, exactly as Ganesha,
   *Vighnaharta*, removes obstacles. Modaks pulled in during the mode give double points.
2. **🥁 Dhol Beat** — the whole festival moves to the procession rhythm. Jump, slide or change
   lane **in time with the beat** to build a combo, up to a **x5** score multiplier. The lights
   flash on the beat to help you feel it.
3. **🌱 Eco Gates** — pick the green **clay murti** gate over the plastic one for a Green Blessing.

### The journey
| Act | Where | What's there |
|---|---|---|
| 1 | **Bazaar at Dawn** | Market streets, flower stalls, sunrise |
| 2 | **Pandal Nights** | String lights, kandil lanterns, dhol players, rangoli |
| 3 | **Visarjan by the Sea** | Moonlit promenade, floating diyas, lantern boats, fireworks |

Between acts a **Bappa Katha** story card appears with a quick quiz question (+500 points).
Finish all three acts to reach the **aarti finale** and earn up to **3 stars**, which unlocks
**Endless Mode**.

---

## 🛠️ Tech

| | |
|---|---|
| Engine | [Three.js](https://threejs.org/) (WebGL) |
| Build tool | [Vite](https://vite.dev/) |
| Language | Plain JavaScript (ES modules), no framework |
| Art | **100% generated in code** — every model from basic shapes, every texture painted on a `<canvas>` |
| Audio | **100% synthesised in code** with the Web Audio API — dhol, tasha, bells, shehnai, conch |
| Download size | about 160 KB gzipped, no image or audio files at all |

Because every asset is generated at runtime, there are **no third-party art or music licences**
involved, and the game loads almost instantly.

### Performance
Graphics quality adapts automatically (Low / Medium / High): it drops if the frame rate falls
and climbs back when the device keeps up. You can also set it by hand on the title screen.
Measured at phone size on the dev machine: **60 fps at High quality**, ~1.9 ms per rendered frame.

---

## 💻 Running it yourself

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open the printed address (usually http://localhost:5173). The dev server also prints a
**Network** address you can open on your phone, if the phone is on the same Wi-Fi.

Production build:

```bash
npm run build
```

The finished site appears in `dist/`, which is a plain static folder: any web host can serve it.

---

## 🚀 Publishing

The build output is static files, so free hosting works:

- **GitHub Pages** — push the repo, then run `npm run build` and publish the `dist/` folder.
- **Netlify / Vercel** — connect the repo, build command `npm run build`, publish directory `dist`.

`vite.config.js` sets `base: './'`, so the game works from any sub-folder without changes.

---

## 📁 Project structure

```
src/
  main.js            entry point, loading screen, buttons, main loop
  core/
    renderer.js      WebGL renderer, bloom, adaptive quality tiers
    input.js         keyboard + swipe, unified into simple actions
  audio/audio.js     all music and sound effects, synthesised live
  player/mushak.js   the Mushak model and his animation
  world/
    world.js         scrolling street, lighting per act, recycled scenery
    festive.js       moon, spotlight beams, bay skyline, diyas, boats, gulal
    textures.js      every texture, painted on canvas
  game/
    game.js          game states, scoring, acts, collisions (the "brain")
    items.js         collectibles, obstacles, eco gates, fair spawn patterns
    finale.js        the aarti shrine scene
  effects/particles.js  pooled GPU particles and fireworks
  ui/ui.js           HUD, menus, story quiz, results
  data/stories.js    Bappa Katha story cards and quiz questions
  dev/bot.js         dev-only playtest bot (never in the published build)
```

A longer explanation of how it all fits together is in
[CODE_WALKTHROUGH.md](CODE_WALKTHROUGH.md).

---

## 🙏 Respect for the theme

Lord Ganesha is never used as an obstacle or a target and is never shown being hurt. In the
finale he is represented reverently, as a radiant golden **ॐ** on a lotus throne inside a
glowing prabhavali arch, with the aarti and the words *Shri Ganeshaya Namah*.

The game also carries the festival's eco-friendly message: choosing natural clay murtis over
plastic and plaster is rewarded, and plastic waste on the road costs you points.
