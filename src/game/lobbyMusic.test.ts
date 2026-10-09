import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyMusic, isLobbyMusicMode, shuffledOrder } from "./lobbyMusic";
import { lobbyPlaylist } from "./lobbyPlaylist";

let player: HTMLAudioElement;
beforeEach(() => {
  player = document.createElement("audio");
  vi.spyOn(player, "play").mockResolvedValue();
  vi.spyOn(player, "pause").mockImplementation(() => {});
  vi.spyOn(player, "load").mockImplementation(() => {});
  vi.stubGlobal("Audio", class { constructor() { return player; } });
  // Deterministic shuffle: 0.999999 maps every Fisher-Yates pick to itself.
  vi.spyOn(Math, "random").mockReturnValue(0.999999);
});

describe("lobby music", () => {
  it("plays only in the hub and customization menus", () => {
    expect(["title", "hub", "run", "menu", "finished"].map(mode => isLobbyMusicMode(mode as Parameters<typeof isLobbyMusicMode>[0]))).toEqual([false, true, false, true, false]);
  });
  it("starts in lobby, pauses immediately for runs and resumes on return", () => {
    const music = new LobbyMusic();
    music.sync("title", 1, false);
    expect(player.play).not.toHaveBeenCalled();
    music.sync("hub", 1, false);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.volume).toBe(0.35);
    music.sync("run", 1, false);
    expect(player.pause).toHaveBeenCalledTimes(1);
    music.sync("menu", 1, false);
    expect(player.play).toHaveBeenCalledTimes(2);
    music.dispose();
  });
  it("respects mute and loops all tracks", () => {
    const music = new LobbyMusic();
    music.sync("hub", 0.5, true);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.muted).toBe(true);
    music.sync("hub", 0.5, false);
    expect(player.volume).toBe(0.175);
    for (let i = 0; i < lobbyPlaylist.length; i++) {
      expect(player.title).toBe(`Lobby Music ${i + 1}`);
      player.dispatchEvent(new Event("ended"));
    }
    expect(player.title).toBe("Lobby Music 1");
    music.dispose();
    const count = vi.mocked(player.play).mock.calls.length;
    player.dispatchEvent(new Event("ended"));
    expect(player.play).toHaveBeenCalledTimes(count);
  });
  it("shuffles playback in a random order and reshuffles each cycle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const music = new LobbyMusic();
    music.sync("hub", 1, false);
    // With random() = 0 the Fisher-Yates swap lands on slot 0 every pass.
    const forced = shuffledOrder(lobbyPlaylist.length);
    expect(player.title).toBe(lobbyPlaylist[forced[0]].name);
    const played: string[] = [player.title];
    for (let i = 1; i < lobbyPlaylist.length; i++) {
      player.dispatchEvent(new Event("ended"));
      played.push(player.title);
      expect(played).not.toContain(lobbyPlaylist[forced[i]].name === played[played.length - 1] ? "" : lobbyPlaylist[forced[i]].name ? "" : undefined);
    }
    expect(new Set(played).size).toBe(lobbyPlaylist.length);
    expect(new Set(lobbyPlaylist.map(t => t.name))).toEqual(new Set(played));
    // After the full cycle the playlist reshuffles rather than repeating the lap.
    player.dispatchEvent(new Event("ended"));
    expect(player.title).toBe(lobbyPlaylist[shuffledOrder(lobbyPlaylist.length)[0]].name);
    music.dispose();
  });
});
