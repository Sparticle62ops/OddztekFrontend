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
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false); // New: Audio Context state
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    cpuLevel: 1,
    networkLevel: 1,
    securityLevel: 1,
    inventory: [],
    theme: 'green'
  });

  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: 'ODDZTEK KERNEL v9.0 [OMNIPOTENCE]', type: 'system' },
    { text: 'Initializing neural interface...', type: 'system' },
    { text: 'Type "help" for command list.', type: 'info' }
  ]);
  const bottomRef = useRef(null);

  // Safe Sound Player
  const sfx = (name) => {
    if(audioUnlocked && AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch((e) => console.log("Audio prevented:", e));
    }
  }

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!BACKEND_URL) return;

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setConnected(true);
        setOutput(prev => [...prev, { text: 'Mainframe Uplink: SECURE', type: 'success' }]);
        
        // Auto-Login Check
        const savedUser = localStorage.getItem('odz_user');
        const savedPass = localStorage.getItem('odz_pass');
        if(savedUser && savedPass) {
             newSocket.emit('login', { username: savedUser, password: savedPass });
        }
    });

    newSocket.on('disconnect', () => {
        setConnected(false);
        setOutput(prev => [...prev, { text: 'CONNECTION LOST. Reconnecting...', type: 'error' }]);
    });
    
    newSocket.on('message', (msg) => {
      setOutput(prev => [...prev, { text: msg.text, type: msg.type }]);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special') sfx('hack');
    });
    
    newSocket.on('play_sound', (name) => sfx(name));
    
    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      if (data.theme) document.body.className = `theme-${data.theme}`;
    });

    return () => newSocket.close();
  }, [audioUnlocked]); // Depend on audioUnlocked to ensure sounds work after click

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => setOutput(prev => [...prev, { text, type }]);

  // --- START SCREEN (Audio Unlock) ---
  const handleStart = () => {
    setAudioUnlocked(true);
    sfx('boot');
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

    switch (command) {
      case 'help':
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
        break;

      // Auth
      case 'register': 
        if (args[1] && args[2]) {
            socket.emit('register', { username: args[1], password: args[2], referralCode: args[3] });
            // Save creds for auto-login
            localStorage.setItem('odz_user', args[1]);
            localStorage.setItem('odz_pass', args[2]);
        }
        else printLine('Usage: register [user] [pass] [code?]', 'error');
        break;
      case 'login': 
        if (args[1] && args[2]) {
            socket.emit('login', { username: args[1], password: args[2] }); 
            // Save creds for auto-login
            localStorage.setItem('odz_user', args[1]);
            localStorage.setItem('odz_pass', args[2]);
        }
        else printLine('Usage: login [user] [pass]', 'error');
        break;
      case 'logout': 
        localStorage.removeItem('odz_user');
        localStorage.removeItem('odz_pass');
        window.location.reload(); 
        break;
      case 'invite': socket.emit('invite'); break;
      
      // System & Utility
      case 'ping':
        const start = Date.now();
        socket.emit('ping', () => {
            const ms = Date.now() - start;
            printLine(`Pong! Latency: ${ms}ms`, 'success');
        });
        break;
        
      case 'theme':
        if(args[1]) socket.emit('set_theme', args[1]);
        else printLine('Usage: theme [green/amber/plasma/matrix]', 'error');
        break;

      // Economy
      case 'mine': socket.emit('mine'); break;
      case 'daily': socket.emit('daily'); break;
      case 'shop': socket.emit('shop'); break;
      case 'leaderboard': socket.emit('leaderboard'); break;
      case 'inv':
      case 'inventory': socket.emit('inventory'); break;
      case 'buy': 
        if (args[1]) socket.emit('buy', args[1]); 
        else printLine('Usage: buy [item_id]', 'error');
        break;
      case 'transfer':
        if (args[1] && args[2]) socket.emit('transfer', { target: args[1], amount: args[2] });
        else printLine('Usage: transfer [user] [amount]', 'error');
        break;
      case 'flip':
      case 'coinflip':
        if (args[1] && args[2]) socket.emit('coinflip', { side: args[1], amount: args[2] });
        else printLine('Usage: flip [heads/tails] [amount]', 'error');
        break;

      // Hacking & Combat
      case 'hack': 
        if (args[1]) socket.emit('hack_init', args[1]);
        else printLine('Usage: hack [user]', 'error');
        break;
      case 'guess': 
        if (args[1]) socket.emit('guess', args[1]);
        else printLine('Usage: guess [number]', 'error');
        break;
      case 'scan': 
        if (args[1]) socket.emit('scan_player', args[1]);
        else printLine('Usage: scan [user]', 'error');
        break;
      case 'brute':
        if (args[1]) socket.emit('brute_force', args[1]);
        else printLine('Usage: brute [user] (Needs Tool)', 'error');
        break;

      // Missions & Puzzles
      case 'server_hack': socket.emit('server_hack_start'); break;
      case 'nav':
      case 'move':
        if (args[1]) socket.emit('navigate', args[1]); // n, s, e, w
        else printLine('Usage: nav [n/s/e/w]', 'error');
        break;

      // Communication
      case 'chat':
        const chatMsg = args.slice(1).join(' ');
        if (chatMsg) socket.emit('global_chat', chatMsg);
        else printLine('Usage: chat [message]', 'error');
        break;

      case 'mail':
        if (args[1] === 'check') socket.emit('mail_check');
        else if (args[1] === 'read' && args[2]) socket.emit('mail_read', args[2]);
        else if (args[1] === 'send') {
            const recipient = args[2];
            const message = args.slice(3).join(' ');
            if(recipient && message) socket.emit('mail_send', { recipient, message });
            else printLine('Usage: mail send [u] [msg]', 'error');
        }
        else printLine('Usage: mail check | mail read [id] | mail send [u] [msg]', 'error');
        break;

      // System
      case 'files': 
      case 'ls':
        socket.emit('files'); 
        break;
      case 'read': 
      case 'cat':
        if (args[1]) socket.emit('read', args[1]); 
        else printLine('Usage: read [filename]', 'error');
        break;

      // Sandbox (Local JS Execution)
      case 'sandbox':
      case 'js':
        const code = args.slice(1).join(' ');
        if (!code) {
            printLine('Usage: sandbox [javascript_code]', 'error');
            break;
        }
        try {
            const safeEval = new Function('console', `
                const window = undefined; 
                const document = undefined; 
                return (${code});
            `);
            const result = safeEval({ log: (msg) => printLine(`[JS] ${msg}`, 'info') });
            if (result !== undefined) printLine(`[JS Result] ${result}`, 'success');
        } catch (e) {
            printLine(`[JS Error] ${e.message}`, 'error');
        }
        break;

      case 'status':
        printLine(`
USER: ${gameState.username}
LEVEL: ${gameState.level} (XP: ${gameState.xp})
BALANCE: ${gameState.balance} ODZ
HARDWARE:
  > CPU: v${gameState.cpuLevel}.0
  > Network: v${gameState.networkLevel || 1}.0
  > Security: v${gameState.securityLevel || 1}.0
        `, 'success');
        break;

      case 'clear': setOutput([]); break;

      default:
        printLine(`ERR: Unknown command '${command}'. Type 'help'.`, 'error');
        sfx('error');
    }
    setInput('');
  };

  return (
    <>
      <MatrixRain active={gameState.theme === 'matrix'} />
      
      {!audioUnlocked ? (
        <div className="start-overlay" onClick={handleStart}>
          <div className="start-content">
            <h1>ODDZTEK SYSTEM v10.0</h1>
            <p>CLICK TO INITIALIZE UPLINK</p>
            <div className="blink">_</div>
          </div>
        </div>
      ) : (
        <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input')?.focus()}>
          <div className={connected ? "connection-status status-connected" : "connection-status status-disconnected"}>
            {connected ? "ONLINE" : "OFFLINE"}
          </div>
          <div className="scanline"></div>
          <div className="terminal-content">
            {output.map((line, i) => <div key={i} className={`line ${line.type}`}>{line.text}</div>)}
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
      )}
      <Analytics />
    </>
  );
}

export default App;
