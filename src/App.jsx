import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

// --- SOUND ASSETS ---
const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  coin: new Audio('https://www.soundjay.com/button/sounds/button-09.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3'),
  hack: new Audio('https://www.soundjay.com/communication/sounds/data-transfer-96kbps.mp3'),
  glitch: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3') // Placeholder for glitch sound
};

// --- COMPONENT: TYPEWRITER EFFECT ---
const TerminalLine = ({ text, type }) => {
  const [displayed, setDisplayed] = useState('');
  const [completed, setCompleted] = useState(false);
  
  useEffect(() => {
    if (type === 'command') {
      setDisplayed(text);
      setCompleted(true);
      return;
    }
    
    let index = 0;
    const speed = type === 'error' ? 5 : 20; // Errors type fast
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayed((prev) => prev + text.charAt(index));
        index++;
        // Optional: Play tiny key click here if desired, but might be too noisy
      } else {
        clearInterval(interval);
        setCompleted(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, type]);

  return <div className={`line ${type} ${completed ? 'done' : 'typing'}`}>{displayed}</div>;
};

// --- COMPONENT: MATRIX RAIN ---
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
  const [started, setStarted] = useState(false); // New Start Screen Logic
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState({
    username: null,
    balance: 0,
    xp: 0,
    level: 1,
    inventory: [],
    theme: 'green'
  });
  
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: 'ODDZTEK KERNEL v10.0 [OMNIPOTENCE]', type: 'system' },
    { text: 'Loading modules...', type: 'system' },
  ]);
  const bottomRef = useRef(null);

  // --- AUDIO HANDLER ---
  const sfx = useCallback((name) => {
    if (started && AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch(e => console.warn("Audio blocked", e));
    }
  }, [started]);

  // --- INITIALIZATION ---
  const initializeSystem = () => {
    setStarted(true);
    sfx('boot');
    
    // Connect Socket
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      // Auto-Login Check
      const savedToken = localStorage.getItem('oddztek_token');
      if (savedToken) {
        newSocket.emit('login_token', savedToken);
        printLine('Biometric Token Found. Authenticating...', 'system');
      } else {
        printLine('Type "help" to begin.', 'info');
      }
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      printLine('CONNECTION LOST. Reconnecting...', 'error');
    });

    newSocket.on('message', (msg) => {
      printLine(msg.text, msg.type);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special' || msg.type === 'glitch') sfx('hack');
      if (msg.type === 'success') sfx('success');
    });

    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      if (data.theme) document.body.className = `theme-${data.theme}`;
      // Save token if provided
      if (data.token) localStorage.setItem('oddztek_token', data.token);
    });

    newSocket.on('play_sound', (name) => sfx(name));
  };

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  // --- COMMAND PARSER ---
  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    sfx('key');
    
    // Optimistic UI update
    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command', id: Date.now() }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket || !connected) {
      printLine("ERROR: System Offline. Check Uplink.", "error");
      return;
    }

    switch (command) {
      case 'help':
        printLine(`
[CORE v10.0]
  register [u] [p] | login [u] [p] | logout
  theme [name]     - Themes: green, amber, plasma, matrix
  
[ECONOMY & SOCIAL]
  mine | daily | shop | buy [id]
  inv | leaderboard | transfer [u] [amt]
  flip [heads/tails] [amt] - Visual Coinflip
  
[FACTIONS (NEW)]
  faction create [name] | faction join [name]
  faction chat [msg]    - Secure Channel
  
[HACKING & TOOLS]
  scan [u] | hack [u] | guess [pin]
  brute [u]      - Auto-Cracker (Tool)
  spy [u]        - Install Keylogger
  nuke [u]       - Plant Logic Bomb
  
[CAMPAIGN]
  mail check     - Read NPC Missions
  server_hack    - Text Adventure Mode
  nav [n/s/e/w]  - Navigation
        `, 'info');
        break;

      // --- CORE & AUTH ---
      case 'register':
        if(args[1] && args[2]) socket.emit('register', { username: args[1], password: args[2] });
        else printLine('Usage: register [user] [pass]', 'error');
        break;
      case 'login':
        if(args[1] && args[2]) socket.emit('login', { username: args[1], password: args[2] });
        else printLine('Usage: login [user] [pass]', 'error');
        break;
      case 'logout':
        localStorage.removeItem('oddztek_token');
        window.location.reload();
        break;
      case 'theme':
        if(args[1]) socket.emit('set_theme', args[1]);
        else printLine('Usage: theme [green/amber/plasma/matrix]', 'error');
        break;

      // --- ECONOMY ---
      case 'mine': socket.emit('mine'); break;
      case 'daily': socket.emit('daily'); break;
      case 'shop': socket.emit('shop'); break;
      case 'leaderboard': socket.emit('leaderboard'); break;
      case 'inv': socket.emit('inventory'); break;
      case 'buy': 
        if(args[1]) socket.emit('buy', args[1]); 
        else printLine('Usage: buy [item_id]', 'error');
        break;
      case 'transfer':
        if(args[1] && args[2]) socket.emit('transfer', { target: args[1], amount: args[2] });
        else printLine('Usage: transfer [user] [amount]', 'error');
        break;
      case 'flip':
        if(args[1] && args[2]) {
           printLine(` tossing coin...`, 'system'); // Visual delay
           setTimeout(() => socket.emit('coinflip', { side: args[1], amount: args[2] }), 1000);
        } else printLine('Usage: flip [h/t] [amt]', 'error');
        break;

      // --- FACTIONS ---
      case 'faction':
        if (args[1] === 'create') socket.emit('faction_create', args[2]);
        else if (args[1] === 'join') socket.emit('faction_join', args[2]);
        else if (args[1] === 'chat') socket.emit('faction_chat', args.slice(2).join(' '));
        else printLine('Usage: faction [create/join/chat]', 'error');
        break;

      // --- HACKING & TOOLS ---
      case 'hack': 
        if(args[1]) socket.emit('hack_init', args[1]);
        else printLine('Usage: hack [user]', 'error');
        break;
      case 'guess': 
        if(args[1]) socket.emit('guess', args[1]); 
        else printLine('Usage: guess [pin]', 'error');
        break;
      case 'scan':
        if(args[1]) socket.emit('scan', args[1]);
        else printLine('Usage: scan [user]', 'error');
        break;
      
      // New Tools
      case 'spy': socket.emit('use_tool', { tool: 'keylogger', target: args[1] }); break;
      case 'nuke': socket.emit('use_tool', { tool: 'logic_bomb', target: args[1] }); break;
      case 'spoof': socket.emit('use_tool', { tool: 'ip_spoofer' }); break;

      // --- CAMPAIGN & SYSTEM ---
      case 'mail': 
        if(args[1] === 'check') socket.emit('mail_check');
        else if(args[1] === 'read') socket.emit('mail_read', args[2]);
        else printLine('Usage: mail check | mail read [id]', 'error');
        break;
        
      case 'server_hack': socket.emit('server_hack_start'); break;
      case 'nav': socket.emit('navigate', args[1]); break;
      
      case 'chat':
        const msg = args.slice(1).join(' ');
        if(msg) socket.emit('global_chat', msg);
        break;

      case 'clear': setOutput([]); break;

      default:
        printLine(`COMMAND UNRECOGNIZED: ${command}`, 'error');
    }
    setInput('');
  };

  return (
    <>
      <MatrixRain active={gameState.theme === 'matrix'} />
      
      {!started && (
        <div className="start-overlay" onClick={initializeSystem}>
          <div className="start-box">
            <h1>SYSTEM HALTED</h1>
            <p>CLICK TO INITIALIZE KERNEL</p>
            <div className="blink">_</div>
          </div>
        </div>
      )}

      <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input')?.focus()}>
        <div className={connected ? "connection-status status-connected" : "connection-status status-disconnected"}>
          {connected ? "NET: ONLINE" : "NET: OFFLINE"}
        </div>
        
        <div className="scanline"></div>
        
        <div className="terminal-content">
          {output.map((line) => (
             <TerminalLine key={line.id} text={line.text} type={line.type} />
          ))}
          
          <div className="input-line">
            <span className="prompt">{gameState.username || 'unknown'}@oddztek:~$</span>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)} 
              autoFocus 
              disabled={!started}
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
