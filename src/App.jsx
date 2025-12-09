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
  
  // State for interactive commands (Login/Register)
  const [inputMode, setInputMode] = useState('command'); // command, login_user, login_pass, reg_user, reg_pass
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

  const handleBoot = () => {
    setBooted(true);
    sfx('boot');
    setOutput([
        { text: 'ODDZTEK KERNEL v11.3 [STABLE]', type: 'system' },
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
      setGameState(prev => ({ ...prev, ...data }));
      if (data.theme) document.body.className = `theme-${data.theme}`;
      if (data.token) localStorage.setItem('oddztek_token', data.token);
    });
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim(); // Allow empty if just pressing Enter to skip, but usually block

   // --- INTERACTIVE MODE LOGIC (FIXED) ---
    if (inputMode !== 'command') {
        if (!cleanCmd) return; 

        if (inputMode === 'login_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `Username: ${cleanCmd}`, type: 'command' }]);
            setInputMode('login_pass');
        } 
        else if (inputMode === 'login_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            
            // FIX: Send as 'cmd' event to match backend v10+
            if (socket) socket.emit('cmd', { 
                command: 'login', 
                args: [tempAuth.user, cleanCmd] 
            });
            
            setInputMode('command');
        } 
        else if (inputMode === 'reg_user') {
            setTempAuth(prev => ({ ...prev, user: cleanCmd }));
            setOutput(prev => [...prev, { text: `New User: ${cleanCmd}`, type: 'command' }]);
            setInputMode('reg_pass');
        } 
        else if (inputMode === 'reg_pass') {
            setOutput(prev => [...prev, { text: `Password: ****`, type: 'command' }]);
            
            // FIX: Send as 'cmd' event
            if (socket) socket.emit('cmd', { 
                command: 'register', 
                args: [tempAuth.user, cleanCmd] 
            });
            
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

    // Local commands
    if (command === 'clear') { setOutput([]); setInput(''); return; }
    if (command === 'logout') { localStorage.removeItem('oddztek_token'); window.location.reload(); return; }

    // Start Interactive Flows
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
    
    // Check Client Handler (Local logic)
    const clientResult = processClientCommand(cleanCmd, gameState);
    if (clientResult.handled) {
        if (clientResult.output) printLine(clientResult.output.text, clientResult.output.type);
        setInput('');
        return;
    }
    
    // Send to Server
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

  // Determine prompt text
  let promptText = `${gameState.username || 'guest'}@oddztek:~$`;
  if (inputMode === 'login_user' || inputMode === 'reg_user') promptText = 'Username:';
  if (inputMode === 'login_pass' || inputMode === 'reg_pass') promptText = 'Password:';

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
  <div key={i} className={`line ${line.type}`}>
    {line.type === 'loading' ? <Spinner text={line.text} /> : line.text}
  </div>
))}
          
          <div className="input-line">
            <span className="prompt">{promptText}</span>
            {/* CLEANED UP INPUT WRAPPER */}
            <div className="input-wrapper" style={{ flexGrow: 1, display: 'flex' }}>
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
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
      <Analytics />
    </>
  );
}

export default App;
