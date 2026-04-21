/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Play, Pause, SkipForward, SkipBack, Target } from 'lucide-react';
import { motion } from 'motion/react';

const DUMMY_TRACKS = [
  { id: 1, title: 'Neon Nights', artist: 'Quantum AI', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'Cyber Drift', artist: 'Neural Net', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 3, title: 'Digital Horizon', artist: 'Synthetix', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' }
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [kills, setKills] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Connection status
  const [isConnected, setIsConnected] = useState(false);

  // Audio Player Logic
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio block:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIdx]);

  useEffect(() => {
    // Set up Audio events
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleEnded = () => {
      setCurrentTrackIdx(prev => (prev + 1) % DUMMY_TRACKS.length);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const skipNext = () => {
    setCurrentTrackIdx(prev => (prev + 1) % DUMMY_TRACKS.length);
    setIsPlaying(true);
  };
  const skipPrev = () => {
    setCurrentTrackIdx(prev => (prev - 1 + DUMMY_TRACKS.length) % DUMMY_TRACKS.length);
    setIsPlaying(true);
  };

  // Game Logic
  useEffect(() => {
    // Determine the socket url
    const socketUrl = window.location.protocol + "//" + window.location.host;
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    let gameState = { players: {} as Record<string, any>, bullets: [] as any[] };
    let myId: string | undefined;

    socket.on('init', (state) => {
      gameState = state;
      myId = socket.id;
    });

    socket.on('state', (state) => {
      gameState = state;
      if (myId && gameState.players[myId]) {
        setKills(gameState.players[myId].kills);
      }
    });

    const GAME_W = 1200;
    const GAME_H = 800;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure canvas respects size
      const scaleX = canvas.width / GAME_W;
      const scaleY = canvas.height / GAME_H;
      const scale = Math.min(scaleX, scaleY);
      
      const offsetX = (canvas.width - GAME_W * scale) / 2;
      const offsetY = (canvas.height - GAME_H * scale) / 2;

      // Draw background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw game container
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Grid for neon aesthetic
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for(let x=0; x<=GAME_W; x+=100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_H);
        ctx.stroke();
      }
      for(let y=0; y<=GAME_H; y+=100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_W, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f3ff';
      ctx.strokeRect(0, 0, GAME_W, GAME_H);
      ctx.shadowBlur = 0; // reset

      // Players
      for (const id in gameState.players) {
        const p = gameState.players[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        if (id === myId) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 28, 0, 2 * Math.PI);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Kills: ${p.kills}`, p.x, p.y - 35);
      }

      // Bullets
      for (const b of gameState.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff007f';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff007f';
        ctx.fill();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    let animationFrameId = requestAnimationFrame(render);

    const keys = { up: false, down: false, left: false, right: false };

    const updateKeys = (e: KeyboardEvent, isDown: boolean) => {
      let updated = false;
      if (['w', 'W', 'ArrowUp'].includes(e.key)) { keys.up = isDown; updated = true; }
      if (['s', 'S', 'ArrowDown'].includes(e.key)) { keys.down = isDown; updated = true; }
      if (['a', 'A', 'ArrowLeft'].includes(e.key)) { keys.left = isDown; updated = true; }
      if (['d', 'D', 'ArrowRight'].includes(e.key)) { keys.right = isDown; updated = true; }
    };

    const onKeyDown = (e: KeyboardEvent) => updateKeys(e, true);
    const onKeyUp =   (e: KeyboardEvent) => updateKeys(e, false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // continuous input loop
    const inputLoop = setInterval(() => {
      socket.emit('move', keys);
    }, 1000 / 60);

    const onMouseClick = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Project canvas coords to game coords
      const scaleX = canvas.width / GAME_W;
      const scaleY = canvas.height / GAME_H;
      const scale = Math.min(scaleX, scaleY);
      
      const offsetX = (canvas.width - GAME_W * scale) / 2;
      const offsetY = (canvas.height - GAME_H * scale) / 2;

      const gameX = (clickX - offsetX) / scale;
      const gameY = (clickY - offsetY) / scale;

      socket.emit('shoot', { x: gameX, y: gameY });
    };

    if (canvasRef.current) {
        canvasRef.current.addEventListener('mousedown', onMouseClick);
    }

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            if (canvasRef.current && containerRef.current) {
                const { width, height } = entry.contentRect;
                canvasRef.current.width = width;
                canvasRef.current.height = height;
            }
        }
    });

    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(inputLoop);
      cancelAnimationFrame(animationFrameId);
      socket.disconnect();
      resizeObserver.disconnect();
      if (canvasRef.current) {
          canvasRef.current.removeEventListener('mousedown', onMouseClick);
      }
    };
  }, []);

  const currentTrack = DUMMY_TRACKS[currentTrackIdx];

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-[radial-gradient(circle_at_top_right,_#1a0b2e,_#050505)] text-white font-sans">
      
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={currentTrack.url} />

      {/* Header / Stats Overlay */}
      <div className="absolute top-5 left-5 right-5 flex justify-between items-start z-10 pointer-events-none font-mono">
        <div className="hud-box" style={{ borderLeft: "4px solid var(--color-neon-blue)" }}>
          <h1 className="text-xl font-bold uppercase tracking-widest text-[var(--color-neon-blue)]">NEON WARS</h1>
          <p className="text-xs tracking-widest opacity-70 mt-1 uppercase">
             {isConnected ? (
                <span className="text-green-400">● Live Server</span>
             ) : (
                <span className="text-red-500">● Offline</span>
             )}
          </p>
        </div>
        <div className="hud-box rounded-[4px] border-l-4 border-[var(--color-neon-pink)]">
          <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-widest">CONFIRMED KILLS</div>
          <div className="flex items-center gap-2 justify-end text-2xl font-bold text-[var(--color-neon-pink)]">
            <Target size={20} />
            <span>{kills}</span>
          </div>
          <div className="text-[10px] text-[var(--color-neon-blue)] mt-2 uppercase tracking-widest">PING: 18MS</div>
        </div>
      </div>

      {/* Game Canvas Container */}
      <div ref={containerRef} className="flex-1 w-full h-full cursor-crosshair relative z-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Music Player Overlay (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="frosted-glass-heavy flex flex-col md:flex-row items-center justify-between px-10 py-5"
        >
          {/* Controls */}
          <div className="flex items-center gap-6">
            <button onClick={skipPrev} className="text-white hover:opacity-100 opacity-80 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button onClick={togglePlay} className="w-[50px] h-[50px] rounded-full bg-[var(--color-neon-pink)] flex items-center justify-center shadow-[0_0_15px_rgba(255,0,127,0.5)] hover:opacity-100 opacity-80 transition-opacity">
              {isPlaying ? <Pause size={24} fill="currentColor" className="text-white" /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            <button onClick={skipNext} className="text-white hover:opacity-100 opacity-80 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <div className="flex-grow max-w-md mx-6 w-full mt-4 md:mt-0">
            <div className="flex justify-between text-[10px] mb-2 opacity-60 font-mono">
              <span>0:00</span>
              <span>LIVE stream</span>
            </div>
            <div className="h-1 bg-[rgba(255,255,255,0.1)] rounded-full relative">
              <div className="w-[65%] h-full bg-[var(--color-neon-blue)] shadow-[0_0_10px_var(--color-neon-blue)] rounded-full flex items-center animate-pulse"></div>
            </div>
          </div>

          <div className="text-right mt-4 md:mt-0">
            <h3 className="font-semibold text-sm text-white">{currentTrack.title}</h3>
            <p className="text-[12px] text-[var(--color-neon-blue)] mt-1">NOW PLAYING</p>
          </div>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="absolute top-[120px] right-5 font-mono text-xs text-white/50 text-right pointer-events-none p-4 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] backdrop-blur-md">
        <p className="mb-1">W A S D - Move Player</p>
        <p>MOUSE - Aim & Shoot</p>
      </div>

    </div>
  );
}
