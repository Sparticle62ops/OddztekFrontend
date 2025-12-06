import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react'; // Analytics Hook
import './App.css';

// --- CONFIGURATION ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; // Your Render URL

// --- SOUND ASSETS ---
const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  coin: new Audio('https://www.soundjay.com/button/sounds/button-09.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3')
};

function App() {
  const [socket, setSocket] = useState(null);
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
  const [output, setOutput] = useState([
    { text: 'ODDZTEK KERNEL v6.0 [SINGULARITY]', type: 'system' },
    { text: 'Mounting virtual file system...', type: 'system' },
    { text: 'Connection established.', type: 'success' },
    { text: 'Type "help" for command list.', type: 'info' }
  ]);
  const bottomRef = useRef(null);

  // Play Sound Helper
  const sfx = (name) => {
    if(AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.4;
      AUDIO[name].play().catch(() => {}); // Ignore autoplay errors
    }
  }

  // --- INITIALIZATION ---
  useEffect(() => {
    sfx('boot'); // Boot sound
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    // Socket Listeners
    newSocket.on('connect', () => printLine('Mainframe Uplink: SECURE', 'success'));
    newSocket.on('message', (msg) => printLine(msg.text, msg.type));
    newSocket.on('play_sound', (name) => sfx(name));
    
    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      // Apply theme dynamically if changed
      if (data.theme) document.body.className = `theme-${data.theme}`;
    });

    return () => newSocket.close();
  }, []);

  // Auto-Scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  // --- COMMAND PARSER ---
  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    sfx('key'); // Typing sound

    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket) return;

    switch (command) {
      case 'help':
        printLine(`
[ACCESS COMMANDS]
  register [user] [pass] - Create Identity
  login [user] [pass]    - Initialize Session
  status                 - View Hardware & Stats
  
[ECONOMY]
  mine           - Start Mining Cycle (20s)
  daily          - Claim 24h Reward (+Bonus for Top 5)
  shop           - View Hardware/Software Upgrades
  buy [item_id]  - Purchase Upgrade
  inventory      - View Installed Modules
  leaderboard    - View Elite Hackers
  
[FILE SYSTEM]
  files          - List Local Files
  read [file]    - Decrypt & Read File (Lore)
  
[SYSTEM]
  clear          - Flush Terminal Buffer
  logout         - Terminate Session
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
        else printLine('Usage: buy [item_id] (e.g., buy cpu_v2)', 'error');
        break;
      case 'leaderboard': socket.emit('leaderboard'); break;
      case 'inv':
      case 'inventory': 
        printLine(`MODULES: ${gameState.inventory.length ? gameState.inventory.join(', ') : 'None'}`, 'info');
        break;

      // System
      case 'files': socket.emit('files'); break;
      case 'read': 
        if (args[1]) socket.emit('read', args[1]);
        else printLine('Usage: read [filename]', 'error');
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
