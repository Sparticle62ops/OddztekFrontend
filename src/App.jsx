import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import { processClientCommand } from './utils/commandHandler';
import MatrixRain from './components/MatrixRain';
import Spinner from './components/Spinner'; 
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
  
  // Interactive Command State
  const [inputMode, setInputMode] = useState('command'); 
  const [tempAuth, setTempAuth] = useState({ user: '', pass: '' });
  
  // Game State (Matches Backend Schema)
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    theme: 'green',
    hardware: { cpu: 1, gpu: 0, ram: 8, servers: 0 }, // Default values to prevent crash
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
        { text: 'ODDZTEK KERNEL v14.0 [DASHBOARD]', type: 'system' },
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
        else printLine('Login required. Type "login".', 'info');
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
      // Merge data safely
      setGameState(prev => ({ 
          ...prev, 
          ...data,
          hardware: data.hardware || prev.hardware, // Ensure hardware object exists
          missionProgress: data.missionProgress || {}
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

    // --- INTERACTIVE MODE (Login/Register) ---
    if (inputMode !== 'command') {
        if (!cleanCmd) return; 

        if (inputMode === 'login_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `Username: ${cleanCmd}`, type: 'command' }]);
            setInputMode('login_pass');
        } 
        else if (inputMode === 'login_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            if (socket) socket.emit('cmd', { command: 'login', args: [tempAuth.user, cleanCmd] });
            setInputMode('command');
        } 
        else if (inputMode === 'reg_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `New User: ${cleanCmd}`, type: 'command' }]);
            setInputMode('reg_pass');
        } 
        else if (inputMode === 'reg_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            if (socket) socket.emit('cmd', { command: 'register', args: [tempAuth.user, cleanCmd] });
            setInputMode('command');
        }
        setInput('');
        return;
    }

    // --- STANDARD COMMAND MODE ---
    if (!cleanCmd) return;
    sfx('key');

    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    // Client-side handlers
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

    // Triggers for interactive mode
    if (command === 'login' && args.length === 1) {
        setInputMode('login_user');
        setInput('');
        return;
    }
    if (command === 'register' && args.length === 1) {
        setInputMode('reg_user');
        setInput('');
        return;
    }

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

  // Prompt Logic
  let promptText = `${gameState.username || 'guest'}@oddztek:~$`;
  if (inputMode.includes('user')) promptText = 'Username:';
  if (inputMode.includes('pass')) promptText = 'Password:';

  // Styles
  const inputStyle = {
    color: gameState.theme === 'matrix' ? '#0f0' : 
           gameState.theme === 'amber' ? '#fb0' :
           gameState.theme === 'plasma' ? '#0ff' : '#0f0'
  };

  // Helper for progress bars (Max level assumed 5 for visualization)
  const getWidth = (val) => `${Math.min(100, (val / 5) * 100)}%`;

  return (
    <div className={`theme-${gameState.theme || 'green'}`} style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <MatrixRain active={gameState.theme === 'matrix'} />
      
      {/* LEFT: TERMINAL */}
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

      {/* RIGHT: DASHBOARD (Only visible if logged in and not guest) */}
      {gameState.username !== 'guest' && (
        <div className="dashboard-container">
            
            {/* 1. SYSTEM STATUS */}
            <div className="widget">
                <h3>System Status</h3>
                <div className="stat-row"><span>USER</span> <span className="stat-val">{gameState.username}</span></div>
                <div className="stat-row"><span>LEVEL</span> <span className="stat-val">{gameState.level}</span></div>
                <div className="stat-row"><span>BALANCE</span> <span className="stat-val" style={{color: '#ff0'}}>{gameState.balance} ODZ</span></div>
                <div className="stat-row"><span>XP</span> <span className="stat-val">{gameState.xp}</span></div>
            </div>

            {/* 2. HARDWARE MONITOR */}
            <div className="widget">
                <h3>Hardware</h3>
                
                <div className="stat-row"><span>CPU (Mining)</span> <span className="stat-val">v{gameState.hardware.cpu}.0</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getWidth(gameState.hardware.cpu) }}></div></div>

                <div className="stat-row"><span>GPU (Hashrate)</span> <span className="stat-val">v{gameState.hardware.gpu}.0</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getWidth(gameState.hardware.gpu) }}></div></div>

                <div className="stat-row"><span>RAM (Exploit)</span> <span className="stat-val">{gameState.hardware.ram} GB</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getWidth(gameState.hardware.ram / 8) }}></div></div>
            </div>

            {/* 3. SERVER FARM */}
            <div className="widget">
                <h3>Server Farm</h3>
                <div className="stat-row"><span>ACTIVE NODES</span> <span className="stat-val">{gameState.hardware.servers}</span></div>
                <div className="stat-row"><span>INCOME RATE</span> <span className="stat-val">{gameState.hardware.servers * 10}/min</span></div>
                <div style={{ fontSize: '0.75rem', marginTop: '5px', opacity: 0.7 }}>
                    {gameState.hardware.servers > 0 ? ">> CRYPTO GENERATION ACTIVE" : ">> OFFLINE (Buy Server Rack)"}
                </div>
            </div>

            {/* 4. ACTIVE MISSION */}
            {gameState.missionProgress && gameState.missionProgress.active && (
                <div className="widget" style={{ borderColor: '#f0f' }}>
                    <h3 style={{ color: '#f0f' }}>Active Mission</h3>
                    <div className="stat-row"><span>TYPE</span> <span className="stat-val">{gameState.missionProgress.active.toUpperCase()}</span></div>
                    <div className="stat-row"><span>STAGE</span> <span className="stat-val">{gameState.missionProgress.stage}</span></div>
                    <div className="stat-row"><span>TARGET</span> <span className="stat-val">{gameState.missionProgress.targetName || 'Unknown'}</span></div>
                </div>
            )}

        </div>
      )}
    </div>
  );
}

export default App;
