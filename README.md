# CardSwipe.io

A single-player neon arena game built with Phaser 3, Vite, and JavaScript. Everything visual is drawn at runtime; audio is synthesized with the Web Audio API. No accounts, backend, network multiplayer, or external audio assets are used.

## Run locally

```sh
pnpm install
pnpm dev
```

For a production build, run `pnpm build`. Vite writes static output to `dist/`.

## Controls

Use WASD or the arrow keys to move on desktop. On touch screens, drag from the lower-left open arena area to steer. Drag a card into the arena to aim and release to cast; drag a card onto another hand card to fuse them. Dragging a card down back over the hand cancels the cast.

## Project layout

- `src/main.js` wires the DOM overlays to the Phaser scene and routes pointer gestures.
- `src/ArenaScene.js` owns arena movement, rival AI, collisions, projectiles, health, score, and effects.
- `src/spells.js` defines the cards, fusion recipes, and procedural Web Audio sounds.
- `src/style.css` styles the responsive home page, HUD, card hand, and game-over screen.
