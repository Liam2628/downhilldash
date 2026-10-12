<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Game math code (src/game) uses dense typed-array indexing, so tsconfig disables noUncheckedIndexedAccess and exactOptionalPropertyTypes.
- Boost ramp render geometry and vehicle collision share track height helpers, so visual ramps match the surface cars drive on.
- Vehicle motion decomposes forward and lateral momentum with delta-time traction; the run mode enforces downhill progress while the hub supports reverse, keeping track rules separate from steering.
- Air trick angles retain whole rotations during leveling so the rendered landing pose and trick scoring agree.
- Track collision runs bounded 120 Hz substeps and shares loop paths and obstacle profiles with rendering to prevent tunneling and surface mismatches.
- Loop deck thickness and rail dimensions are shared by rendering and swept collision; throttle, brake and boost remain active but lateral steering is locked, and the camera keeps a cached side-view target through exit to avoid discontinuities.

- Dev-only devtools source tags are stripped from src/game and src/components .tsx files in vite.config.ts, because the 3D renderer crashes on dashed prop names.
- Lobby music uses a central CDN-backed playlist and a disposable browser audio controller synchronized with game mode and existing sound settings, so future tracks need only playlist additions and music cannot continue during runs.
- Generate multi-chunk areas independently of 100 m streaming chunks so playable pacing does not depend on renderer window size.
- Area layouts use five authored presets drawn from per-type shuffled bags, and a shared boost placement policy resolves feature approaches across chunk boundaries before rendering, keeping variation and safety independent of streaming.
- Anchor roadside props through terrainMeshY's triangle interpolation so their bases match the rendered terrain rather than a separate smooth height approximation.
