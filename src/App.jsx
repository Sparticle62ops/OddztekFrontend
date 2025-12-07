import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3'),
  hack: new Audio('https://www.soundjay.com/communication/sounds/data-transfer-96kbps.mp3')
};

// --- ROBUST TYPEWRITER ---
const TerminalLine = ({ text, type, instant }) => {
  const [displayed, setDisplayed] = useState(instant ? text : '');
  const hasRun = useRef(false);

  useEffect(() => {
    if (instant || hasRun.current) { setDisplayed(text); return; }
    hasRun.current = true;
    if(!text) return;

    let index = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, index + 1));
      index++;
      if (index >= text.length) clearInterval(interval);
    }, 10);
    return () => clearInterval(interval);
  }, [text, instant]);

  return <div className={`line ${type}`}>{displayed}</div>;
};

// --- MATRIX RAIN ---
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
  const [started, setStarted] = useState(false);
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
    { text: 'ODDZTEK KERNEL v10.3 [STABLE]', type: 'system', instant: true },
    { text: 'Modules loaded. System Ready.', type: 'system', instant: true },
    { text: 'Type "help" for command list.', type: 'info', instant: true },
  ]);
  const bottomRef = useRef(null);

  const sfx = useCallback((name) => {
    if (started && AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch(() => {});
    }
  }, [started]);

  const printLine = (text, type = 'response', instant = false) => {
    const id = Date.now() + Math.random().toString();
    setOutput(prev => [...prev, { text, type, instant, id }]);
  };

  const initializeSystem = () => {
    setStarted(true);
    sfx('boot');
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      const savedToken = localStorage.getItem('oddztek_token');
      if (savedToken) {
        newSocket.emit('login_token', savedToken);
        printLine('Token detected. Authenticating...', 'system');
      }
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      printLine('CONNECTION LOST. Retrying...', 'error');
    });

    newSocket.on('message', (msg) => {
      printLine(msg.text, msg.type, msg.instant);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'success') sfx('success');
      if (msg.type === 'special') sfx('hack');
    });

    newSocket.on('pong', (ms) => {
        printLine(`Pong! Latency: ${Date.now() - ms}ms`, 'success');
    });

    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      if (data.theme) document.body.className = `theme-${data.theme}`;
      if (data.token) localStorage.setItem('oddztek_token', data.token);
    });

    newSocket.on('play_sound', (name) => sfx(name));
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    sfx('key');
    
    setOutput(prev => [...prev, { text: `${gameState.username || 'guest'}@oddztek:~$ ${cleanCmd}`, type: 'command', instant: true, id: Date.now() }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket || !connected) {
      printLine("ERROR: System Offline. Check Uplink.", "error");
      return;
    }

    switch (command) {
      case 'help':
        printLine(`
[CORE]
  register [u] [p] | login [u] [p] | logout
  ping | status | clear
  theme [name]     - Themes: green, amber, plasma, matrix
  
[ECONOMY]
  mine | daily | shop | buy [id]
  inv | leaderboard | transfer [u] [amt]
  flip [heads/tails] [amt] - Gamble
  
[SYSTEM & FILES]
  files | ls      - List files
  read [file]     - Read file
  sandbox [code]  - Run JS
  
[HACKING]
  scan [u] | hack [u] | guess [pin]
  brute [u] | spy [u] | nuke [u]
  
[SOCIAL & MISSIONS]
  chat [msg] | mail check | mail send [u] [m]
  server_hack | nav [n/s/e/w]
        `, 'info', true);
        break;

      // --- CORE ---
      case 'ping': socket.emit('ping', Date.now()); break;
      case 'status':
      case 'whoami':
      case 'balance':
        printLine(`User: ${gameState.username}\nLevel: ${gameState.level}\nBalance: ${gameState.balance} ODZ`, 'info', true);
        break;
      
      case 'register': 
        if(args[1] && args[2]) socket.emit('register', { username: args[1], password: args[2] });
        else printLine('Usage: register [user] [pass]', 'error');
        break;
      case 'login': 
        if(args[1] && args[2]) socket.emit('login', { username: args[1], password: args[2] });
        else printLine('Usage: login [user] [pass]', 'error');
        break;
      case 'logout': localStorage.removeItem('oddztek_token'); window.location.reload(); break;
      case 'theme': if(args[1]) socket.emit('set_theme', args[1]); break;

      // --- ECONOMY ---
      case 'mine': socket.emit('mine'); break;
      case 'daily': socket.emit('daily'); break;
      case 'shop': socket.emit('shop'); break;
      case 'leaderboard': socket.emit('leaderboard'); break;
      case 'inv': socket.emit('inventory'); break;
      case 'buy': if(args[1]) socket.emit('buy', args[1]); break;
      case 'transfer': if(args[1] && args[2]) socket.emit('transfer', { target: args[1], amount: args[2] }); break;
      case 'flip': if(args[1] && args[2]) socket.emit('coinflip', { side: args[1], amount: args[2] }); break;

      // --- FILES & SYSTEM ---
      case 'files': socket.emit('files'); break;
      case 'ls': socket.emit('files'); break;
      case 'read': if(args[1]) socket.emit('read', args[1]); break;
      case 'cat': if(args[1]) socket.emit('read', args[1]); break;
      
      case 'sandbox':
        const code = args.slice(1).join(' ');
        try {
            const safeEval = new Function('console', `return (${code})`);
            const res = safeEval({ log: (m) => printLine(`[JS] ${m}`, 'info') });
            if(res !== undefined) printLine(`Result: ${res}`, 'success');
        } catch(e) { printLine(`JS Error: ${e.message}`, 'error'); }
        break;

      // --- HACKING ---
      case 'hack': if(args[1]) socket.emit('hack_init', args[1]); break;
      case 'guess': if(args[1]) socket.emit('guess', args[1]); break;
      case 'scan': if(args[1]) socket.emit('scan', args[1]); break;
      case 'spy': socket.emit('use_tool', { tool: 'keylogger', target: args[1] }); break;
      case 'nuke': socket.emit('use_tool', { tool: 'logic_bomb', target: args[1] }); break;
      case 'brute': socket.emit('brute_force', args[1]); break;

      // --- SOCIAL ---
      case 'chat': 
        const msg = args.slice(1).join(' ');
        if(msg) socket.emit('global_chat', msg); 
        else printLine('Usage: chat [message]', 'error');
        break;
      case 'mail': 
        if(args[1] === 'check') socket.emit('mail_check');
        else if(args[1] === 'read') socket.emit('mail_read', args[2]);
        else if(args[1] === 'send') {
           if(args[2] && args[3]) socket.emit('mail_send', { recipient: args[2], body: args.slice(3).join(' ') });
           else printLine('Usage: mail send [user] [msg]', 'error');
        }
        else printLine('Usage: mail check | read [id] | send [u] [m]', 'error');
        break;
      
      case 'faction':
        if(args[1] === 'create') socket.emit('faction_create', args[2]);
        else if(args[1] === 'join') socket.emit('faction_join', args[2]);
        else if(args[1] === 'chat') socket.emit('faction_chat', args.slice(2).join(' '));
        else printLine('Usage: faction [create/join/chat]', 'error');
        break;

      case 'server_hack': socket.emit('server_hack_start'); break;
      case 'nav': if(args[1]) socket.emit('navigate', args[1]); break;

      case 'clear': setOutput([]); break;
      default: printLine(`Unknown command: ${command}`, 'error');
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
        <div className="connection-status">{connected ? "NET: ONLINE" : "NET: OFFLINE"}</div>
        <div className="scanline"></div>
        <div className="terminal-content">
          {output.map((line) => (
             <TerminalLine key={line.id} text={line.text} type={line.type} instant={line.instant} />
          ))}
          <div className="input-line">
            <span className="prompt">{gameState.username || 'guest'}@oddztek:~$</span>
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
