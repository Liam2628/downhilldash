import track1 from "@/assets/music/lobby-music-1.mp3.asset.json";
import track2 from "@/assets/music/lobby-music-2.mp3.asset.json";
import track3 from "@/assets/music/lobby-music-3.mp3.asset.json";
import track4 from "@/assets/music/lobby-music-4.mp3.asset.json";
import track5 from "@/assets/music/lobby-music-5.mp3.asset.json";
import track6 from "@/assets/music/lobby-music-6.mp3.asset.json";
import track7 from "@/assets/music/lobby-music-7.mp3.asset.json";
import track8 from "@/assets/music/lobby-music-8.mp3.asset.json";

// Append future uploads here; playback automatically includes every entry.
export const lobbyPlaylist = [track1, track2, track3, track4, track5, track6, track7, track8].map((asset, index) => ({
  name: `Lobby Music ${index + 1}`,
  url: asset.url,
}));
