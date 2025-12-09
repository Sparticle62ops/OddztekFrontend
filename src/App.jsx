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
  
  // Game State defaults
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    theme: 'green',
    // Hardware Default so Dashboard isn't empty
    hardware: { cpu: 1, gpu: 0, ram: 8, servers: 0 },
    missionProgress: { active: null, stage: 0 },
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
        { text: 'ODDZTEK KERNEL v14.2 [VISUAL]', type: 'system' },
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
      // Direct render of messages
      if (msg.text) setOutput(prev => [...prev, { text: msg.text, type: msg.type }]);
      
      if (msg.type === 'error') sfx('error');
      if (msg.type === 'special' || msg.type === 'success') sfx('hack');
    });
    
    newSocket.on('player_data', (data) => {
      setGameState(prev => ({ 
          ...prev, 
          ...data,
          // Safety merge for nested objects
          hardware: data.hardware ? { ...prev.hardware, ...data.hardware } : prev.hardware,
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

    // Client Commands
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

    if (command === 'login' && args.length === 1) { setInputMode('login_user'); setInput(''); return; }
    if (command === 'register' && args.length === 1) { setInputMode('reg_user'); setInput(''); return; }

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

  // Helper for bars (Assuming max levels: CPU 5, GPU 5, RAM 64)
  const getW = (val, max) => `${Math.min(100, (val / max) * 100)}%`;

  return (
    <div className={`app-layout theme-${gameState.theme || 'green'}`}>
      <MatrixRain active={gameState.theme === 'matrix'} />
      
      {/* 1. HUD: Fixed Top Right */}
      <div className="hud-container">
          <div className="status-indicator">
              <span>SERVER: US-EAST</span>
              <div className={connected ? "status-dot on" : "status-dot off"} />
          </div>
          {gameState.username !== 'guest' && (
              <div className="balance-display">
                  {gameState.balance} ODZ
              </div>
          )}
      </div>

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
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)} 
              autoFocus 
              autoComplete="off"
            />
          </div>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* RIGHT SIDE DASHBOARD */}
      {gameState.username !== 'guest' && (
        <div className="dashboard-container">
            
            <div className="widget">
                <h3>System Status</h3>
                <div className="stat-row"><span>USER</span> <span className="stat-val">{gameState.username}</span></div>
                <div className="stat-row"><span>LEVEL</span> <span className="stat-val">{gameState.level}</span></div>
                <div className="stat-row"><span>XP</span> <span className="stat-val">{gameState.xp}/{gameState.level * 250}</span></div>
            </div>

            <div className="widget">
                <h3>Hardware Array</h3>
                
                <div className="stat-row"><span>CPU [MINING]</span> <span className="stat-val">v{gameState.hardware.cpu}.0</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getW(gameState.hardware.cpu, 5) }}></div></div>

                <div className="stat-row"><span>GPU [CRACKER]</span> <span className="stat-val">v{gameState.hardware.gpu}.0</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getW(gameState.hardware.gpu, 3) }}></div></div>

                <div className="stat-row"><span>RAM [BUFFER]</span> <span className="stat-val">{gameState.hardware.ram}GB</span></div>
                <div className="bar-container"><div className="bar-fill" style={{ width: getW(gameState.hardware.ram, 32) }}></div></div>
            </div>

            <div className="widget">
                <h3>Server Farm</h3>
                <div className="stat-row"><span>NODES</span> <span className="stat-val">{gameState.hardware.servers}</span></div>
                <div className="stat-row"><span>YIELD</span> <span className="stat-val">{gameState.hardware.servers * 10}/min</span></div>
            </div>

            {gameState.missionProgress && gameState.missionProgress.active && (
                <div className="widget" style={{ borderColor: '#f0f' }}>
                    <h3 style={{ color: '#f0f', borderBottomColor:'rgba(255,0,255,0.3)' }}>Active Ops</h3>
                    <div className="stat-row"><span>TYPE</span> <span className="stat-val">{gameState.missionProgress.active.toUpperCase()}</span></div>
                    <div className="stat-row"><span>STAGE</span> <span className="stat-val">{gameState.missionProgress.stage}/4</span></div>
                    <div style={{fontSize: '0.75rem', marginTop: '5px', color: '#f0f'}}>
                        Target: {gameState.missionProgress.targetName || 'Unknown'}
                    </div>
                </div>
            )}

        </div>
      )}
    </div>
  );
}

export default App;
