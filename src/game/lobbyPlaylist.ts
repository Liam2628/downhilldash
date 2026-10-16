// Tracks live in public/music/ so they are committed to the repo.
// Append future tracks here; playback automatically includes every entry.
export const lobbyPlaylist = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  name: `Lobby Music ${n}`,
  url: `/music/lobby-${n}.mp3`,
}));
