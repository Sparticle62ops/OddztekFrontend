import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import { processClientCommand } from './utils/commandHandler';
import MatrixRain from './components/MatrixRain';
import Spinner from './components/Spinner'; 
import './App.css';

// --- CONFIGURATION ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

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
  
  const [inputMode, setInputMode] = useState('command'); 
  const [tempAuth, setTempAuth] = useState({ user: '', pass: '' });
  
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    theme: 'green',
    hardware: { cpu: 1, gpu: 0, ram: 8, servers: 0 },
    missionProgress: {},
    inventory: []
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

  const handleBoot = () => {
    setBooted(true);
    sfx('boot');
    setOutput([
        { text: 'ODDZTEK OS v17.0 [REMASTERED]', type: 'system' },
        { text: 'Initializing secure neural uplink...', type: 'system' },
        { text: 'Connection established. Welcome, Operator.', type: 'success' },
        { text: 'Type "help" to access system manual.', type: 'info' }
    ]);
    
    if (!BACKEND_URL) return;
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setConnected(true);
        printLine('Mainframe Uplink: SECURE', 'success');
        const savedToken = localStorage.getItem('oddztek_token');
        if (savedToken) newSocket.emit('auth_token', savedToken);
        else printLine('Login required. Type "login".', 'info');
    });

    newSocket.on('disconnect', () => {
        setConnected(false);
        printLine('CONNECTION LOST. Retrying...', 'error');
    });
    
    newSocket.on('message', (msg) => {
      if (msg.text) setOutput(prev => [...prev, { text: msg.text, type: msg.type }]);
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special' || msg.type === 'success') sfx('hack');
    });
    
    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ 
          ...prev, 
          ...data,
          hardware: data.hardware ? { ...prev.hardware, ...data.hardware } : prev.hardware
      }));
      
      if (data.theme) document.body.className = `theme-${data.theme}`;
      if (data.token) localStorage.setItem('oddztek_token', data.token);
    });
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim(); 

    // --- INTERACTIVE MODE ---
    if (inputMode !== 'command') {
        if (!cleanCmd) return; 
        if (inputMode === 'login_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `Username: ${cleanCmd}`, type: 'command' }]);
            setInputMode('login_pass');
        } else if (inputMode === 'login_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            if (socket) socket.emit('cmd', { command: 'login', args: [tempAuth.user, cleanCmd] });
            setInputMode('command');
        } else if (inputMode === 'reg_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `New User: ${cleanCmd}`, type: 'command' }]);
            setInputMode('reg_pass');
        } else if (inputMode === 'reg_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            if (socket) socket.emit('cmd', { command: 'register', args: [tempAuth.user, cleanCmd] });
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

    // Client Logic
    const clientResult = processClientCommand(cleanCmd, gameState);
    if (clientResult.handled) {
        if (clientResult.output) printLine(clientResult.output.text, clientResult.output.type);
        if (clientResult.action === 'clear') setOutput([]);
        if (clientResult.action === 'logout') {
            localStorage.removeItem('oddztek_token');
            window.location.reload();
        }
        setInput('');
        return;
    }

    if (command === 'login') { setInputMode('login_user'); setInput(''); return; }
    if (command === 'register') { setInputMode('reg_user'); setInput(''); return; }

    if (!socket || !connected) {
      printLine("ERROR: System Offline.", "error");
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

  let promptText = `${gameState.username || 'guest'}@oddztek:~$`;
  if (inputMode.includes('user')) promptText = 'Username:';
  if (inputMode.includes('pass')) promptText = 'Password:';

  const inputStyle = {
    color: gameState.theme === 'matrix' ? '#0f0' : 
           gameState.theme === 'amber' ? '#fb0' :
           gameState.theme === 'plasma' ? '#0ff' : '#0f0'
  };

  return (
    <div className={`app-layout theme-${gameState.theme || 'green'}`}>
      <MatrixRain active={gameState.theme === 'matrix'} />
      
      {/* 1. HUD: Minimalist Top Right */}
      <div className="hud-container">
          <div className="status-indicator">
              <span>NET: US-EAST</span>
              <div className={connected ? "status-dot on" : "status-dot off"} />
          </div>
          {gameState.username !== 'guest' && (
              <div className="balance-display">
                  {gameState.balance} ODZ
              </div>
          )}
      </div>

      {/* 2. FULL SCREEN TERMINAL */}
      <div className="terminal-container" onClick={() => document.querySelector('input')?.focus()}>
        <div className="scanline"></div>
        <div className="terminal-content">
          {output.map((line, i) => (
             <div key={i} className={`line ${line.type} ${line.type === 'art' ? 'art' : ''}`}>
                {line.type === 'loading' ? <Spinner text={line.text} /> : line.text}
             </div>
          ))}
          
          <div className="input-line">
            <span className="prompt">{promptText}</span>
            <input 
              type={inputMode.includes('pass') ? "password" : "text"} 
              value={input} 
              style={inputStyle}
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)} 
              autoFocus 
              autoComplete="off"
            />
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
