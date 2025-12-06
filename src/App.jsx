import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

// --- CONFIGURATION ---
// REPLACE WITH YOUR ACTUAL RENDER BACKEND URL
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

function App() {
  const [socket, setSocket] = useState(null);
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
    { text: 'ODDZTEK KERNEL v6.2 [BREACH PROTOCOL]', type: 'system' },
    { text: 'Mounting virtual file system...', type: 'system' },
    { text: 'Connection established.', type: 'success' },
    { text: 'Type "help" for command list.', type: 'info' }
  ]);
  const bottomRef = useRef(null);

  // Sound Helper
  const sfx = (name) => {
    if(AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch(() => {});
    }
  }

  // --- INITIALIZATION ---
  useEffect(() => {
    sfx('boot');
    
    // Safety check for URL
    if (!BACKEND_URL || BACKEND_URL.includes("YOUR_RENDER_URL")) {
        setOutput(prev => [...prev, { text: "ERROR: Backend URL not configured.", type: "error" }]);
        return;
    }

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setOutput(prev => [...prev, { text: 'Mainframe Uplink: SECURE', type: 'success' }]);
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
  }, []);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  // --- COMMAND PARSER (v7.0) ---
  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    sfx('key');

    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket) return;

    switch (command) {
      case 'help':
        printLine(`
[ACCESS]
  register [u] [p] / login [u] [p]
  status / whoami / logout
  
[ECONOMY]
  mine           - Start Mining (20s)
  daily          - Claim Reward
  shop / buy [id]- Black Market
  inventory      - View Modules
  leaderboard    - Top Hackers
  
[HACKING]
  scan [user]    - Recon Target
  hack [user]    - Start Breach
  guess [pin]    - Input PIN (Digit Reveal Active)
  
[COMMUNICATION]
  mail check     - Read Inbox
  mail send [u] [msg] - Send Message
  
[SYSTEM]
  files / read [f] - File System
  clear          - Clear Screen
        `, 'info');
        break;

      // Auth
      case 'register': socket.emit('register', { username: args[1], password: args[2] }); break;
      case 'login': socket.emit('login', { username: args[1], password: args[2] }); break;
      case 'logout': window.location.reload(); break;

      // Economy
      case 'mine': socket.emit('mine'); break;
      case 'daily': socket.emit('daily'); break;
      case 'shop': socket.emit('shop'); break;
      case 'buy': 
        if (args[1]) socket.emit('buy', args[1]);
        else printLine('Usage: buy [item_id]', 'error');
        break;
      case 'leaderboard': socket.emit('leaderboard'); break;
      case 'inv':
      case 'inventory': 
        printLine(`MODULES: ${gameState.inventory.length ? gameState.inventory.join(', ') : 'None'}`, 'info');
        break;

      // Hacking
      case 'hack': 
        if (args[1]) socket.emit('hack_init', args[1]);
        else printLine('Usage: hack [target_user]', 'error');
        break;
      case 'guess': 
        if (args[1]) socket.emit('guess', args[1]);
        else printLine('Usage: guess [pin]', 'error');
        break;
      case 'scan': 
        if (args[1]) socket.emit('scan_player', args[1]);
        else printLine('Usage: scan [target]', 'error');
        break;

      // Communication (New)
      case 'mail':
        if (args[1] === 'check') socket.emit('mail_check');
        else if (args[1] === 'send') {
          // Rejoin the rest of the arguments for the message body
          const recipient = args[2];
          const message = args.slice(3).join(' ');
          if (recipient && message) socket.emit('mail_send', { recipient, message });
          else printLine('Usage: mail send [user] [message]', 'error');
        } else {
          printLine('Usage: mail check OR mail send [user] [msg]', 'error');
        }
        break;

      // System
      case 'files': socket.emit('files'); break;
      case 'read': 
        if (args[1]) socket.emit('read', args[1]);
        else printLine('Usage: read [filename]', 'error');
        break;

      case 'status':
      case 'whoami':
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
      <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input')?.focus()}>
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
      <Analytics />
    </>
  );
}

export default App;
