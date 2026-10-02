# Code Walkthrough — Mushak Yatra

A short guide to how the game works, so you can explain any part of it.
Read this once and you'll be able to answer "how did you build this?"

---

## 1. The big idea

**Mushak never actually moves forward.** He stays at `z = 0` and only moves left/right and
up/down. The whole world slides toward the camera instead. Every frame the game works out one
number, `dz` (how far the world moved this frame), and gives it to the street, the obstacles and
the particles. That is why the game can run forever without the numbers growing too large.

```
dz = speed × time since last frame
```

## 2. Start-up (`src/main.js`)

1. Show the loading screen.
2. Build the renderer (`core/renderer.js`), audio, input and the game.
3. Render 3 warm-up frames so the graphics card compiles its shaders before the title appears,
   which prevents a stutter on the first real frame.
4. Start the main loop.

The main loop is deliberately simple:

```js
const loop = (now) => {
  requestAnimationFrame(loop);   // asked for first, so one error can never freeze the game
  const dt = Math.min(0.05, (now - last) / 1000);  // capped so a long pause can't teleport Mushak
  try { game.update(dt); renderer.render(); renderer.trackFps(dt); }
  catch (err) { console.error(err); }
};
```

**`dt`** is the seconds since the last frame. Everything is multiplied by `dt`, so the game runs
at the same speed on a 60 Hz phone and a 144 Hz monitor.

## 3. The game brain (`src/game/game.js`)

A simple state machine: `menu → play → story → finale → results`, plus `pause`.
`update(dt)` looks at the state and runs the matching branch. Only the `play` branch moves the
world, so pausing is simply "don't call the play branch".

Each frame in `play`:
1. Work out the speed (faster each act) and `dz`.
2. Ask `items.spawnAhead()` to lay out new road ahead of the player.
3. Move Mushak (lanes, jump physics, slide timers).
4. Move the world and the items by `dz`, and check collisions.
5. Update the camera, the HUD and the music intensity.
6. If the act's distance is finished, start the story card or the finale.

### Jump physics
Normal gravity, nothing clever:
```js
p.vy += GRAVITY * dt;   // GRAVITY = -38
p.y  += p.vy * dt;      // jump starts at vy = 12.5 → about 2 m high, 0.66 s in the air
```
**Jump buffering:** if you press jump slightly before landing, the press is stored for 0.2 s and
fires the moment Mushak touches down. This is why the controls feel forgiving.

### Scoring
Points come from distance, modaks, offerings, rangolis, eco gates, dodges and quiz answers, all
multiplied by the Dhol Beat multiplier (x1 to x5).

## 4. The three special mechanics

**Vighnaharta Mode** (`startVighna()`): collecting 21 modaks sets `p.vighna = 5` seconds. While
it's above zero, `items.update()` turns every obstacle ahead into petals instead of hitting
Mushak, and uncollected modaks fly toward him (the magnet).
*The balance trick:* modaks collected **during** the mode give double points but do **not**
refill the meter — otherwise the magnet would collect enough modaks to trigger it again forever,
and the player would be permanently invincible (this actually happened in testing).

**Dhol Beat** (`checkBeat()`): the music scheduler knows exactly when each beat happens. When you
act, the game asks the audio system how far you are from the nearest beat; within 0.12 s counts,
and the combo grows. The check subtracts the speaker output delay (`audio.latency()`), because
players tap to what they *hear*, not to what the code scheduled.

**Eco Gates:** a row of three gates where one is clay and the others are plastic. Running through
the clay one gives a Green Blessing, the plastic one costs points.

## 5. Fair obstacle patterns (`src/game/items.js`)

The spawner has three rules that guarantee every pattern is actually survivable:
1. The free lane moves **at most one lane** from the previous row's free lane.
2. **Never two tall obstacles in one row**, so a neighbouring lane is always an escape.
3. Rows are at least **one jump apart** (`speed × 0.85`), so two jumpable obstacles can never be
   closer together than a single jump covers.

Act 1 also stays gentle (single obstacles) for its first 60%.

These rules came from the playtest bot (see section 9) finding hits that a human couldn't have
avoided either.

### Collision
No physics engine. A collision is three plain comparisons: same lane (within 0.95 m sideways),
close in depth (within 0.9 m), and the right height — a low obstacle is cleared if `y > 0.62`,
a high one if the player is sliding, and a tall one blocks the lane completely.

## 6. The world (`src/world/world.js`)

The street is built from **12 segments of 16 m**. When a segment slides past the camera it is
moved to the far end and refilled with scenery for the current act. Memory use therefore stays
flat whether you play for 1 minute or 20.

Each act has an environment (sky colours, fog, sun and lamp brightness) and the game **blends**
between them over 3 seconds, which is how dawn turns into night.

`festive.js` adds the night layer: moon, sweeping spotlight beams, the city skyline across the
bay, floating diyas, lantern boats and gulal clouds.

**Lights pulse on the beat:** `world.beat` is `exp(-beatPhase × 5)`, which is 1 exactly on a beat
and fades between beats; it drives the brightness of the string lights and lamps.

## 7. Art and sound, generated in code

**Textures** (`world/textures.js`) are drawn with ordinary 2D canvas commands — the rangoli is
a loop drawing petals around a circle, the building fronts are rectangles for windows, the road
is random paving slabs with noise.

**Mushak** (`player/mushak.js`) is spheres, cylinders and capsules in a group. There is no
animation file: the run cycle is `Math.sin()` on the leg rotations, and jumping squashes and
stretches his body.

**Audio** (`audio/audio.js`) is synthesised: the dhol is a sine wave whose pitch drops from 130 Hz
to 48 Hz in 0.18 s plus a burst of filtered noise for the skin slap; the shehnai melody is a
sawtooth through a band-pass filter with vibrato, playing notes from **Raga Bhupali**. A
look-ahead scheduler queues notes 120 ms early so the rhythm never drifts.

## 8. Particles (`effects/particles.js`)

One `THREE.Points` object holds thousands of particles drawn in a single GPU call. Particles are
pooled: emitting reuses the oldest slot, so nothing is allocated during play (which would cause
stutter). A custom shader rotates and fades each particle, and clamps its on-screen size so a
particle near the camera can't cover the screen.

## 9. The playtest bot (`src/dev/bot.js`, dev only)

A simulated player with a reaction delay (0.25–0.45 s) and a chance to miss obstacles. It plays
complete runs in a few seconds and reports score, hits and whether any hit was **unfair** (an
obstacle it saw in time but still could not avoid). It was used to tune difficulty and to set the
star thresholds, and it is excluded from the published build.

```js
const bot = await __loadBot();
await bot.profile(3);   // runs good / average / casual players, 3 runs each
```

## 10. Performance choices

- **Quality tiers** (Low / Medium / High) change pixel ratio, shadows, bloom and particle counts.
  Quality drops when the frame rate does and climbs back when it recovers; one-off stalls are
  ignored.
- **Shared geometry and materials:** scenery clones share the same objects, so there is one
  upload to the graphics card, not hundreds.
- **Instanced meshes** draw the 22 bulbs of a string of lights in one call.
- Lights are mostly *emissive materials plus bloom* rather than real lights, because real lights
  are expensive on phones.

---

## Likely questions

**"Did you use a game engine?"**
No. Three.js is a rendering library; the game loop, physics, collisions, spawning, scoring and
state machine are all written by hand in this repo.

**"Where did the art and music come from?"**
Everything is generated in code at runtime — no downloaded images, models or audio files. That is
why the whole game is about 160 KB gzipped.

**"How do you know the game is fair?"**
A bot plays full runs and reports hits it could not avoid. The spawner rules in section 5 came
directly from fixing the cases it found; the final runs reported zero unavoidable hits.

**"How does it run on both phones and laptops?"**
One codebase: swipes and keys both map to the same four actions, the camera widens its field of
view in portrait, and the graphics quality adapts to the device.
