import { lobbyPlaylist } from "./lobbyPlaylist";
import type { Mode } from "./store";

export function isLobbyMusicMode(mode: Mode) {
  return mode === "hub" || mode === "menu";
}

export function shuffledOrder(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export class LobbyMusic {
  private player: HTMLAudioElement | null = null;
  private order: number[] = [];
  private orderPos = 0;
  private lastIndex = 0;
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
      this.order = shuffledOrder(lobbyPlaylist.length);
      this.orderPos = 0;
      this.lastIndex = this.playlistIndex();
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

  private playlistIndex() {
    return this.order[this.orderPos] ?? 0;
  }

  private load() {
    const track = lobbyPlaylist[this.playlistIndex()];
    if (this.player && track) {
      this.player.src = track.url;
      this.player.title = track.name;
    }
  }

  private next = () => {
    if (this.failed.size >= lobbyPlaylist.length) return;
    let guard = 0;
    do {
      this.orderPos++;
      if (this.orderPos >= this.order.length) {
        // Full cycle played: reshuffle so the order differs each lap.
        this.order = shuffledOrder(lobbyPlaylist.length);
        this.orderPos = 0;
        if (this.order.length > 1 && this.order[0] === this.lastIndex) {
          [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
        }
      }
      guard++;
    } while (this.failed.has(this.playlistIndex()) && guard <= lobbyPlaylist.length);
    this.lastIndex = this.playlistIndex();
    this.load();
    this.resume();
  };

  private skipFailed = () => {
    this.failed.add(this.playlistIndex());
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
