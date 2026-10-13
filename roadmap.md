# Roadmap
- [ ] Boost placement: flat approaches to ramps/loops, even spacing with occasional pairs, unchanged boost visuals/behavior; five gameplay variations per area and regression/live checks
- [x] Track feel: 100 m clean downhill opening, 300–600 m interesting areas, triangle-grounded scenery, stronger actual downhill acceleration and closer/lower speed camera; regression tests and browser-driven travel checked (later-area screenshot timed out)
- [x] Add five renamed lobby-only music tracks with an extensible playlist; automated mute/mode/playlist tests pass and all audio URLs return successfully (audible playback not confirmed in headless browser)
- [x] Phase 2: predictable traversable barriers, stable ramp edges and safer boosted blind jumps
- [x] Phase 2: solid loop decks/supports, angled entry, steering/boost and smooth exit camera; straight exit runoff
- [x] Phase 2: hub gate cancellation orientation and recovery
- [x] Thicken tire coin rubber to meet the rim
- [x] Test Phase 2 scenarios in regression tests and the running game (34 tests passed; no browser page errors)
- [x] Phase 1: Q/E spins; braking/reverse steering; downhill-only slope; controlled drift; responsive flips; air leveling; out-of-bounds recovery
- [x] Verify Phase 1 driving scenarios in the running game and automated regression tests
- [x] Rename game Downhill Dash with white DOWNHILL and forward-leaning orange DASH
- [x] Give boost pads raised wedge geometry and one activation per run; double manual boost recharge
- [x] Match ramp surfaces to driving collision; Q/E spins and Z/C barrel rolls in air
- [x] Real crashes, crash sounds, solid collisions, cones pushable, air control, autosave, no Space jump, electric cars, instant camera snap, pause stops game
- [ ] On-screen boost button
- [ ] Controls card closable forever; Settings > Controls with rebindable keys
- [x] Coins look like real wheels
- [ ] Top-bar style unified; readable over the sky
- [x] Remove checkered flag at finish
- [ ] Finish texturing; remove lamp posts; fix stats board wood layout
- [x] Daily Rewards: readable from all sides, chest popup w/ blur, weighted 100-1500 (usually 130-250)
- [ ] Space returns to lobby
- [ ] Don't get stuck between ramps

## Cone/loop/polish batch (Oct 9)
- [x] One nice cone model everywhere, with collisions, respawn, sunk into ground; cone field after finish
- [x] Loop drop-off yaw fix; unstuck after 3s near a loop
- [x] Flat pads say "BOOST"; keybind shows "SHIFT"; boost button touch-only; stats board line removed
- [x] Audio wakes on any key press
- [x] Loop collisions share deck thickness/rail dimensions, sweep both circular faces, and tighten support bounds; tests and live boosted-loop traversal passed
- [x] Restore five curved boost ramps with solid sides; retain three flat strips
- [ ] Double-tap W/S auto front/back flips
- [x] Wood grain on fence/stats board, stone on footings/loop supports; camera air lift eases across ramp edges; 40 tests passed and desktop/small-screen scenes rendered without page errors
- [ ] C camera toggle; split times vs PB; daily quests

## Phase 3 — Endless track
- [x] Session 1: endless random track (new course every visit, no finish line, distance counter, drawn in a moving window)
- [x] Session 2: Mega Launch (red round spring launcher, rare, much stronger than boost ramps)
- [ ] Session 3: track-ahead indicator (ramps, turns, loops, Mega Launches) + long-run testing

## Batch: collisions + lobby hills
- [x] Barriers: no landing/driving on top
- [x] Loop collision accuracy
- [x] Cones as one object, no ground sinking/line
- [x] Hills shrink gradually near lobby (not too early)
- [x] Finish Phase 3 Session 3 (long-run verification)
