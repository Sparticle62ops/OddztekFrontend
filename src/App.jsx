import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

// --- CONFIG ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3'),
  hack: new Audio('https://www.soundjay.com/communication/sounds/data-transfer-96kbps.mp3')
};

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [started, setStarted] = useState(false);
  
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    level: 1,
    xp: 0,
    theme: 'green'
  });

  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: 'ODDZTEK OS [RECOVERY BUILD]', type: 'system' },
    { text: 'System Stabilized.', type: 'success' },
    { text: 'Type "help" for commands.', type: 'info' }
  ]);
  const bottomRef = useRef(null);

  const sfx = (name) => {
    if (started && AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].volume = 0.3;
      AUDIO[name].play().catch(() => {});
    }
  };

  // --- LOGGING HELPER ---
  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
  };

  const initSystem = () => {
    setStarted(true);
    sfx('boot');
    
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      printLine("UPLINK ESTABLISHED.", "success");
      // Auto-login check
      const token = localStorage.getItem('oddztek_token');
      if (token) newSocket.emit('login_token', token);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      printLine("CONNECTION LOST.", "error");
    });

    newSocket.on('message', (msg) => {
      printLine(msg.text, msg.type);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'success') sfx('success');
      if (msg.type === 'special') sfx('hack');
    });

    newSocket.on('player_data', (data) => {
      setGameState(prev => ({...prev, ...data}));
      if(data.theme) document.body.className = `theme-${data.theme}`;
      if(data.token) localStorage.setItem('oddztek_token', data.token);
    });

    newSocket.on('pong', () => printLine("Pong! Server is reachable.", "success"));
    
    newSocket.on('play_sound', (n) => sfx(n));
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const handleCommand = (cmd) => {
    if (!cmd.trim()) return;
    sfx('key');
    
    // Echo command to screen
    const user = gameState.username || 'guest';
    printLine(`${user}@oddztek:~$ ${cmd}`, 'command');

    const args = cmd.trim().split(' ');
    const command = args[0].toLowerCase();

    if (!socket || !connected) {
      printLine("ERROR: System Offline. Check Internet.", "error");
      setInput('');
      return;
    }

    switch (command) {
      case 'help':
        printLine(`
[CORE]
  register [u] [p] | login [u] [p] | logout
  ping | status | clear | theme [name]
  
[ECONOMY]
  mine | daily | shop | buy [id]
  inv | transfer [u] [amt]
  flip [heads/tails] [amt]
  
[HACKING]
  scan [u] | hack [u] | guess [pin]
  
[SOCIAL]
  chat [msg] | mail check | mail read [id]
  mail send [u] [msg]
        `, 'info');
        break;

      // CORE
      case 'ping': socket.emit('ping'); break;
      case 'clear': setOutput([]); break;
      case 'status': 
      case 'whoami':
      case 'balance':
        printLine(`USER: ${gameState.username}\nLEVEL: ${gameState.level}\nBAL: ${gameState.balance} ODZ`, 'info');
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

      // ECONOMY
      case 'mine': socket.emit('mine'); break;
      case 'daily': socket.emit('daily'); break;
      case 'shop': socket.emit('shop'); break;
      case 'inv': socket.emit('inventory'); break;
      case 'buy': if(args[1]) socket.emit('buy', args[1]); break;
      case 'transfer': if(args[1] && args[2]) socket.emit('transfer', { target: args[1], amount: args[2] }); break;
      case 'flip': if(args[1] && args[2]) socket.emit('coinflip', { side: args[1], amount: args[2] }); break;

      // HACKING
      case 'hack': if(args[1]) socket.emit('hack_init', args[1]); break;
      case 'guess': if(args[1]) socket.emit('guess', args[1]); break;
      case 'scan': if(args[1]) socket.emit('scan', args[1]); break;

      // SOCIAL
      case 'chat': 
        const msg = args.slice(1).join(' ');
        if(msg) socket.emit('global_chat', msg); 
        else printLine('Usage: chat [message]', 'error');
        break;
      case 'mail':
        if(args[1] === 'check') socket.emit('mail_check');
        else if(args[1] === 'read') socket.emit('mail_read', args[2]);
        else if(args[1] === 'send') socket.emit('mail_send', { recipient: args[2], body: args.slice(3).join(' ') });
        else printLine('Usage: mail check | read [id] | send [u] [m]', 'error');
        break;

      default:
        printLine(`Unknown command: ${command}`, 'error');
    }
    setInput('');
  };

  return (
    <>
      {!started && (
        <div className="start-overlay" onClick={initSystem} style={{
          position:'fixed', top:0, left:0, right:0, bottom:0, 
          background:'black', zIndex:999, display:'flex', 
          justifyContent:'center', alignItems:'center', color:'#0f0', 
          fontSize:'2rem', cursor:'pointer', border:'2px solid #0f0'
        }}>
          CLICK TO INITIALIZE SYSTEM
        </div>
      )}
      
      <div className={`terminal-container theme-${gameState.theme}`} onClick={() => document.querySelector('input')?.focus()}>
        <div style={{position:'absolute', top:10, right:10, color: connected ? '#0f0' : '#f00'}}>
          {connected ? "ONLINE" : "OFFLINE"}
        </div>
        <div className="terminal-content">
          {output.map((line) => (
            <div key={line.id} className={`line ${line.type}`}>{line.text}</div>
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
