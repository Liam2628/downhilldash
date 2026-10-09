import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { Hub } from "./Hub";
import { Track } from "./Track";
import { Player } from "./Player";
import { HUD } from "./ui/HUD";
import { bindInput, orbit, rebinding } from "./input";
import { useGame, useSave } from "./store";
import { audio } from "./audio";
import { exitMenu, returnToLobby } from "./physics";
import { LobbyMusic } from "./lobbyMusic";

export function Game() {
  const [fontsReady, setFontsReady] = useState(false);
  const quality = useSave((s) => s.settings.quality);
  const volume = useSave((s) => s.settings.volume);
  const muted = useSave((s) => s.settings.muted);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    Promise.all([document.fonts.load("40px Bungee"), document.fonts.load("20px Rubik")]).then(finish, finish);
    const t = setTimeout(finish, 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => bindInput(), []);
  useEffect(() => audio.setVolume(volume, muted), [volume, muted]);

  useEffect(() => {
    const music = new LobbyMusic();
    const sync = () => {
      const settings = useSave.getState().settings;
      music.sync(useGame.getState().mode, settings.volume, settings.muted);
    };
    sync();
    const unsubscribeGame = useGame.subscribe(sync);
    const unsubscribeSave = useSave.subscribe(sync);
    const wakeAudio = () => audio.init();
    window.addEventListener("pointerdown", music.resume);
    window.addEventListener("keydown", music.resume);
    window.addEventListener("keydown", wakeAudio);
    window.addEventListener("pointerdown", wakeAudio);
    return () => {
      unsubscribeGame();
      unsubscribeSave();
      window.removeEventListener("pointerdown", music.resume);
      window.removeEventListener("keydown", music.resume);
      window.removeEventListener("keydown", wakeAudio);
      window.removeEventListener("pointerdown", wakeAudio);
      music.dispose();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState();
      if (rebinding.active) return;
      if (e.code === "Escape") {
        if (g.chestOpen) {
          g.setChestOpen(false);
          return;
        }
        if (g.settingsOpen) g.setSettingsOpen(false);
        else if (g.mode === "menu") exitMenu();
        else if (g.mode !== "title") g.setSettingsOpen(true);
      }
      if (e.code === "KeyR" && (g.mode === "run" || g.mode === "hub") && !g.settingsOpen && !g.chestOpen && !rebinding.active) {
        returnToLobby();
        g.popup("BACK TO LOBBY", "cool");
      }
      if (e.code === "Space" && !g.settingsOpen && !g.chestOpen && (g.mode === "run" || g.mode === "finished")) {
        e.preventDefault();
        returnToLobby();
        if (g.mode === "run") g.popup("BACK TO LOBBY", "cool");
      }
      if (e.code === "Enter" && g.mode === "finished") returnToLobby();
      if (e.code === "KeyM" && !rebinding.active) {
        const s = useSave.getState();
        s.setSettings({ muted: !s.settings.muted });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (useGame.getState().mode !== "menu") return;
    orbit.dragging = true;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!orbit.dragging) return;
    orbit.yaw -= (e.clientX - orbit.lastX) * 0.008;
    orbit.pitch = Math.max(0.05, Math.min(1.2, orbit.pitch + (e.clientY - orbit.lastY) * 0.005));
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;
  };
  const onUp = () => (orbit.dragging = false);

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      {fontsReady && (
        <Canvas
          shadows={quality === "high"}
          dpr={quality === "high" ? [1, 1.75] : [0.75, 1]}
          camera={{ position: [40, 30, 90], fov: 60, near: 0.3, far: 1400 }}
          gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#9fd3f5"]} />
          <fog attach="fog" args={["#bfe2f7", 120, 620]} />
          <Sky sunPosition={[120, 80, 60]} turbidity={4} rayleigh={0.8} mieCoefficient={0.004} distance={4000} />
          <hemisphereLight args={["#dff2ff", "#6a8a4a", 0.9]} />
          <ambientLight intensity={0.25} />
          <Environment resolution={64}>
            <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
            <Lightformer intensity={1.2} color="#ffd9a8" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
            <Lightformer intensity={1} color="#a8d8ff" position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
          </Environment>
          <Suspense fallback={null}>
            <Hub />
          </Suspense>
          <Track />
          <Player />
        </Canvas>
      )}
      <HUD />
    </div>
  );
}
