import { lobbyPlaylist } from "./lobbyPlaylist";
import type { Mode } from "./store";

export function isLobbyMusicMode(mode: Mode) {
  return mode === "hub" || mode === "menu";
}

export class LobbyMusic {
  private player: HTMLAudioElement | null = null;
  private index = 0;
  private active = false;
  private muted = false;
  private failed = new Set<number>();

  sync(mode: Mode, volume: number, muted: boolean) {
    this.active = isLobbyMusicMode(mode);
    this.muted = muted;
    if (!this.player && !this.active) return;
    if (!this.player) {
      this.player = new Audio();
      this.player.preload = "none";
      this.player.addEventListener("ended", this.next);
      this.player.addEventListener("error", this.skipFailed);
      this.load();
    }
    this.player.volume = Math.max(0, Math.min(1, volume)) * 0.35;
    this.player.muted = muted;
    this.resume();
  }

  resume = () => {
    if (!this.player) return;
    if (!this.active || this.muted) {
      this.player.pause();
      return;
    }
    if (this.failed.size >= lobbyPlaylist.length) return;
    // Browsers may require another click/key press before allowing music.
    void this.player.play().catch(() => {});
  };

  private load() {
    const track = lobbyPlaylist[this.index];
    if (this.player && track) {
      this.player.src = track.url;
      this.player.title = track.name;
    }
  }

  private next = () => {
    if (this.failed.size >= lobbyPlaylist.length) return;
    do {
      this.index = (this.index + 1) % lobbyPlaylist.length;
    } while (this.failed.has(this.index));
    this.load();
    this.resume();
  };

  private skipFailed = () => {
    this.failed.add(this.index);
    this.next();
  };

  dispose() {
    if (!this.player) return;
    this.player.pause();
    this.player.removeEventListener("ended", this.next);
    this.player.removeEventListener("error", this.skipFailed);
    this.player.removeAttribute("src");
    this.player.load();
    this.player = null;
    this.failed.clear();
  }
}