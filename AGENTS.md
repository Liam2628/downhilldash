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

- Dev-only devtools source tags are stripped from src/game and src/components .tsx files in vite.config.ts, because the 3D renderer crashes on dashed prop names.
