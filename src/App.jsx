import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import { processClientCommand } from './utils/commandHandler'; // Import the new handler
import MatrixRain from './components/MatrixRain';
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

function App() {
  const [booted, setBooted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // --- NEW STATE FOR INTERACTIVE LOGIN ---
  const [inputMode, setInputMode] = useState('command'); // 'command', 'login_user', 'login_pass', 'reg_user', 'reg_pass'
  const [tempAuth, setTempAuth] = useState({ user: '', pass: '' });
  
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

  // --- BOOT SEQUENCE (Same as before) ---
  const handleBoot = () => {
    setBooted(true);
    sfx('boot');
    setOutput([
        { text: 'ODDZTEK KERNEL v11.1 [SECURE]', type: 'system' },
        { text: 'Initializing neural interface...', type: 'system' },
        { text: 'Type "help" for command list.', type: 'info' }
    ]);
    
    if (!BACKEND_URL) return;
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setConnected(true);
        printLine('Mainframe Uplink: SECURE', 'success');
        const savedToken = localStorage.getItem('oddztek_token');
        if (savedToken) newSocket.emit('auth_token', savedToken);
        else printLine('Login required.', 'info');
    });

    newSocket.on('disconnect', () => {
        setConnected(false);
        printLine('CONNECTION LOST. Retrying...', 'error');
    });
    
    newSocket.on('message', (msg) => {
      printLine(msg.text, msg.type);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special') sfx('hack');
    });
    
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
    
    // --- HANDLING INTERACTIVE MODES ---
    if (inputMode !== 'command') {
        if (inputMode === 'login_user') {
            setTempAuth({ ...tempAuth, user: cleanCmd });
            printLine(`Username: ${cleanCmd}`, 'command');
            printLine('Password:', 'info');
            setInputMode('login_pass');
        } else if (inputMode === 'login_pass') {
            // Send Login
            printLine('Password: ****', 'command');
            socket.emit('login', { username: tempAuth.user, password: cleanCmd });
            setInputMode('command');
        } else if (inputMode === 'reg_user') {
            setTempAuth({ ...tempAuth, user: cleanCmd });
            printLine(`Username: ${cleanCmd}`, 'command');
            printLine('Set Password:', 'info');
            setInputMode('reg_pass');
        } else if (inputMode === 'reg_pass') {
            // Send Register
            printLine('Password: ****', 'command');
            socket.emit('register', { username: tempAuth.user, password: cleanCmd });
            setInputMode('command');
        }
        setInput('');
        return;
    }

    if (!cleanCmd) return;
    sfx('key');

    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    // 1. LOCAL COMMANDS
    if (command === 'clear') { setOutput([]); setInput(''); return; }
    if (command === 'logout') { localStorage.removeItem('oddztek_token'); window.location.reload(); return; }

    // --- TRIGGER INTERACTIVE LOGIN ---
    if (command === 'login') {
        if (args[1]) {
            // Old way still works: login user pass
            if (args[2]) socket.emit('login', { username: args[1], password: args[2] });
            else printLine('Usage: login [user] [pass]', 'error');
        } else {
            // Start Interactive Mode
            printLine('Username:', 'info');
            setInputMode('login_user');
        }
        setInput('');
        return;
    }

    if (command === 'register') {
        if (args[1]) {
            if (args[2]) socket.emit('register', { username: args[1], password: args[2], referralCode: args[3] });
            else printLine('Usage: register [user] [pass] [code?]', 'error');
        } else {
            printLine('New Username:', 'info');
            setInputMode('reg_user');
        }
        setInput('');
        return;
    }

    // 2. SERVER COMMANDS
    if (!socket || !connected) {
      printLine("ERROR: System Offline. Please wait...", "error");
      return;
    }
    
    // Check local handler first
    const clientResult = processClientCommand(cleanCmd, gameState);
    if (clientResult.handled) {
        if (clientResult.output) printLine(clientResult.output.text, clientResult.output.type);
        setInput('');
        return;
    }
    
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

  const inputStyle = {
    color: gameState.theme === 'matrix' ? '#0f0' : 
           gameState.theme === 'amber' ? '#fb0' :
           gameState.theme === 'plasma' ? '#0ff' : '#0f0'
  };

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
            <span className="prompt">
                {inputMode === 'command' ? `${gameState.username || 'guest'}@oddztek:~$` : 
                 (inputMode.includes('user') ? 'Username: ' : 'Password: ')}
            </span>
            <div className="input-wrapper" style={{ display: 'flex', width: '100%' }}>
                <input 
                  type={inputMode.includes('pass') ? "password" : "text"} 
                  value={input} 
                  style={inputStyle}
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)} 
                  autoFocus 
                  autoComplete="off"
                />
                <span className="blinking-cursor">_</span>
            </div>
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
      <Analytics />
    </>
  );
}

export default App;
