import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Analytics } from '@vercel/analytics/react';
import './App.css';

// --- CONFIGURATION ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

// --- SOUNDS ---
const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  boot: new Audio('https://www.soundjay.com/button/sounds/beep-01a.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  hack: new Audio('https://www.soundjay.com/communication/sounds/data-transfer-96kbps.mp3')
};

// --- VISUAL COMPONENTS ---
const MatrixRain = ({ active }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const fontSize = 14;
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

const Typewriter = ({ text }) => {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplay(prev => prev + text.charAt(i));
        i++;
      } else clearInterval(timer);
    }, 15); // Speed of typing
    return () => clearInterval(timer);
  }, [text]);
  return <span>{display}</span>;
};

function App() {
  const [booted, setBooted] = useState(false); // New Boot State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    theme: 'green',
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

  // --- BOOT SEQUENCE ---
  const handleBoot = () => {
    setBooted(true);
    sfx('boot');
    setOutput([{ text: 'SYSTEM INITIALIZED... ODDZTEK v10.0', type: 'system' }]);
    
    // Connect Socket
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
        setConnected(true);
        printLine('Uplink Established.', 'success');
        
        // Auto-Login Check
        const savedToken = localStorage.getItem('oddztek_token');
        if (savedToken) {
            newSocket.emit('auth_token', savedToken);
        } else {
            printLine('Login required.', 'info');
        }
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
        // Save token on successful login
        if (data.username !== 'guest') localStorage.setItem('oddztek_token', data.token); 
    });
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const handleCommand = (cmd) => {
    if (!cmd.trim()) return;
    sfx('key');
    const user = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${user}@oddztek:~$ ${cmd}`, type: 'command' }]);
    
    const args = cmd.trim().split(' ');
    const command = args[0].toLowerCase();

    if (!socket || !connected) {
        printLine('ERROR: Offline. Command queued.', 'error');
        return;
    }

    // Pass everything to server, client-side switch is minimal now
    // We handle simple UI stuff here, logic on server
    switch(command) {
        case 'clear': setOutput([]); break;
        case 'logout': 
            localStorage.removeItem('oddztek_token'); 
            window.location.reload(); 
            break;
        default:
            socket.emit('cmd', { command, args }); // Unified Command Emitter
            // Set timeout for silent failures
            setTimeout(() => {
                // Ideally we'd track IDs to know if THIS specific cmd failed, 
                // but for now, if connection drops, the socket.on('disconnect') handles it.
            }, 2000);
            break;
    }
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

  return (
    <>
      <MatrixRain active={gameState.theme === 'matrix'} />
      <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input')?.focus()}>
        <div className={connected ? "status-light on" : "status-light off"} />
        
        <div className="terminal-content">
          {output.map((line, i) => (
            <div key={i} className={`line ${line.type}`}>
              {line.type === 'command' ? line.text : <Typewriter text={line.text} />}
            </div>
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
