import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

// --- CONFIGURATION ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

// --- SOUND ASSETS ---
const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  coin: new Audio('https://www.soundjay.com/button/sounds/button-09.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3'),
  hack: new Audio('https://www.soundjay.com/communication/sounds/data-transfer-96kbps.mp3') 
};

// --- MATRIX RAIN COMPONENT ---
const MatrixRain = ({ active }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&*';
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0F0';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, [active]);

  return <canvas id="matrix-canvas" ref={canvasRef} style={{ display: active ? 'block' : 'none' }} />;
};

function App() {
  const [booted, setBooted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    cpuLevel: 1,
    inventory: [],
    theme: 'green'
  });

  const [input, setInput] = useState('');
  const [output, setOutput] = useState([]);
  const bottomRef = useRef(null);

  const sfx = (name) => {
    if(AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch(() => {});
    }
  }

  // --- BOOT SEQUENCE ---
  const handleBoot = () => {
    setBooted(true);
    sfx('boot');
    setOutput([
        { text: 'ODDZTEK KERNEL v10.1 [STABLE]', type: 'system' },
        { text: 'Initializing neural interface...', type: 'system' },
        { text: 'Type "help" for command list.', type: 'info' }
    ]);
    
    // Connect Socket
    if (!BACKEND_URL) return;
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setConnected(true);
        printLine('Mainframe Uplink: SECURE', 'success');
        
        // Auto-Login Check
        const savedToken = localStorage.getItem('oddztek_token');
        if (savedToken) {
            newSocket.emit('auth_token', savedToken);
        } else {
            printLine('Login required.', 'info');
        }
    });

    newSocket.on('disconnect', () => {
        setConnected(false);
        printLine('CONNECTION LOST. Retrying...', 'error');
    });
    
    newSocket.on('message', (msg) => {
      // Remove Typewriter effect logic here, just push plain text
      printLine(msg.text, msg.type);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special') sfx('hack');
    });
    
    newSocket.on('play_sound', (name) => sfx(name));
    
    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      if (data.theme) document.body.className = `theme-${data.theme}`;
      if (data.token) localStorage.setItem('oddztek_token', data.token);
    });
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  // --- COMMAND PARSER ---
  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    sfx('key');

    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket || !connected) {
      printLine("ERROR: System Offline. Please wait...", "error");
      return;
    }

    // --- CLIENT-SIDE COMMANDS ---
    // These commands are handled entirely by the frontend
    
    if (command === 'clear') {
        setOutput([]);
        setInput('');
        return;
    }
    
    if (command === 'logout') {
        localStorage.removeItem('oddztek_token');
        window.location.reload();
        return;
    }

    if (command === 'help') {
        printLine(`
[CORE]
  register [u] [p] (code) | login [u] [p]
  status | invite | logout | clear
  theme [name]   - Switch Theme (green, amber, plasma, matrix)
  ping           - Check latency
  
[ECONOMY]
  mine | daily | shop | buy [id]
  inv | leaderboard | transfer [u] [amt]
  flip [heads/tails] [amt] - Coinflip Gamble
  
[HACKING]
  scan [u] | hack [u] | guess [pin]
  brute [u] (Requires Tool)
  
[MISSIONS]
  server_hack    - Raid Oddztek Mainframe (Hard)
  nav [dir]      - Move in Server (n/s/e/w)
  
[COMMUNICATION]
  chat [msg]     - Global Chat
  mail check     - Read Inbox
  mail send [u] [msg] - Send Message
  mail read [id] - Mark message as read
  
[SYSTEM]
  files | read [f] 
  sandbox [code] - Run JavaScript (Beta)
        `, 'info');
        setInput('');
        return;
    }

    // --- SERVER COMMANDS ---
    // If not a client command, send to server via the unified 'cmd' event
    // The previous version had separate emits for everything, but the V10 backend
    // expects a single 'cmd' event.
    
    socket.emit('cmd', { command: command, args: args.slice(1) });
    setInput('');
  };

  if (!booted) {
    return (
      <div className="boot-screen" onClick={handleBoot}>
        <h1>ODDZTEK OS</h1>
        <p>[ CLICK TO INITIALIZE SYSTEM ]</p>
      </div>
    );
  }

  return (
    <>
      <MatrixRain active={gameState.theme === 'matrix'} />
      <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input')?.focus()}>
        <div className={connected ? "status-light on" : "status-light off"} />
        <div className="scanline"></div>
        <div className="terminal-content">
          {output.map((line, i) => (
            <div key={i} className={`line ${line.type}`}>{line.text}</div>
          ))}
          <div className="input-line">
            <span className="prompt">{gameState.username || 'guest'}@oddztek:~$</span>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)} 
              autoFocus 
            />
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
      <Analytics />
    </>
  );
}

export default App;
