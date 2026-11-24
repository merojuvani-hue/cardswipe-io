# TODO — CardSwipe.io

## Home screen and player setup
- [ ] Load immediately into a responsive Home Screen with a glowing `CARDSWIPE.IO` title over a live animated dark-neon grid background.
- [ ] Render the playable character in the center and offer four selectable skins/auras: `Arcane Cyan`, `Inferno Red`, `Venom Green`, and `Solar Gold`.
- [ ] Provide a player name input with `Player` as the default.
- [ ] Show a compact three-card preview strip explaining that dragging onto the arena aims a trajectory and dragging two cards together fuses them.
- [ ] Provide a large glowing `ENTER ARENA` button that transitions smoothly to Arena Mode.

## Arena and HUD
- [ ] Build a bounded `2400 x 2400` top-down neon arena with smooth camera follow, solid/destructible geometric pillars, healing Mana Orbs that restore `+15 HP` and add `+10 Score`, and `12` AI rival fighters with floating HP bars and names.
- [ ] Support smooth 360-degree movement using a bottom-left floating virtual joystick on mobile and WASD/arrow keys on desktop.
- [ ] Keep three active cards visible at the bottom-center of the screen.
- [ ] Show player HP (`100/100`) and a small `HOME` button at top-left; show a live Top-5 leaderboard and golden crown above the #1 fighter at top-right.
- [ ] On game over, display Kills, Score, Final Rank, `PLAY AGAIN`, and `HOME SCREEN`.

## Cards, aiming and fusion
- [ ] Implement a five-card starter deck: Fireball (red, fast explosive projectile, `35 DMG` plus small splash); Frost Shard (cyan, piercing ice lance, `25 DMG` and slows enemy movement by `50%` for `2s`); Volt Bolt (yellow, high-speed lightning shot, `30 DMG` and bounces once to a nearby enemy); Blink Dash (purple, dash/teleport along aimed trajectory, `15 DMG` trail plus brief invulnerability); Shock Nova (green, wide crescent energy wave, `30 DMG` plus heavy knockback).
- [ ] When a hand card is dragged upward into the arena, apply `0.85x` focus time and draw a bright dotted aiming trajectory plus impact reticle from the player in the drag direction and range.
- [ ] On release, cast along the trajectory, remove that card from its slot, and deal a fresh card into that empty slot after `1.2s`; dragging back down to the hand cancels cleanly.
- [ ] Allow dragging Card A directly onto Card B in the three-card hand to fuse into one glowing Fused Ultimate Card, leaving one empty slot to refill after `1.2s`.
- [ ] Implement Fireball + Volt Bolt = Plasma Beam (`60 DMG`, instant long-range piercing laser); Fireball + Frost Shard = Thermal Shatter (`50 DMG`, huge AoE, `2s` freeze); Blink Dash + Fireball = Meteor Charge (`55 DMG` AoE dash); Volt Bolt + Shock Nova = Storm Ring (three lightning waves, `45 DMG` each); Frost Shard + Blink Dash = Shadow Step (teleport forward and leave a freezing decoy); all other pairs = Arcane Overdrive.

## Effects and delivery
- [ ] Generate procedural Web Audio SFX for card hover/draw tick, fusion power-up chime, spell launch whoosh, hit impact, and defeat boom; use no external audio files.
- [ ] Add crisp screen shake, floating damage numbers such as `-35` and `-60`, and particle trails on every projectile.
- [ ] Use Phaser 3 + Vite + HTML5/JavaScript, not Godot WebAssembly. Keep the project English-only and client-side without accounts, backend, or multiplayer.

## Recent movement and combat tuning
- [x] Add a visible, responsive bottom-left virtual joystick with drag feedback and dead-zone control, while keeping WASD and arrow-key movement available.
- [x] Reduce player maximum movement speed from `270` to `150` world units per second and lower movement acceleration.
- [x] Make Volt Bolt and Storm Ring read visually as lightning with bright jagged electric trails; extend Storm Ring's fan range and keep Volt Bolt's bounce focused on a nearby rival.
