import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// --- CONFIG ---
const BACKEND_URL = "https://oddztekbackend.onrender.com"; 

// --- SOUNDS (Using generic URLs for now) ---
const AUDIO = {
  key: new Audio('https://www.soundjay.com/button/sounds/button-16.mp3'),
  error: new Audio('https://www.soundjay.com/button/sounds/button-10.mp3'),
  success: new Audio('https://www.soundjay.com/button/sounds/button-3.mp3'),
  login: new Audio('https://www.soundjay.com/mechanical/sounds/mechanical-clonk-1.mp3'),
  coin: new Audio('https://www.soundjay.com/button/sounds/button-09.mp3')
};

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({ username: 'guest', balance: 0, level: 1, theme: 'green' });
  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: 'ODDZTEK OS v5.0 (Deep Net)', type: 'system' },
    { text: 'Type "register [name] [pass]" to begin.', type: 'info' }
  ]);
  const bottomRef = useRef(null);

  // PLAY SOUND HELPER
  const playSound = (name) => {
    if(AUDIO[name]) {
      AUDIO[name].currentTime = 0;
      AUDIO[name].play().catch(e => console.log("Audio play failed (user interaction needed)"));
    }
  };

  useEffect(() => {
    if (!BACKEND_URL) return;
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => printLine('Link Established.', 'success'));
    newSocket.on('message', (msg) => printLine(msg.text, msg.type));
    newSocket.on('player_data', (data) => setGameState(data));
    
    // SERVER TRIGGERS SOUND
    newSocket.on('play_sound', (soundName) => playSound(soundName));

    return () => newSocket.close();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [output]);

  const printLine = (text, type = 'response') => setOutput(prev => [...prev, { text, type }]);

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;
    
    // Typing Sound
    playSound('key');

    const userPrompt = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${userPrompt}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket) return;

    switch (command) {
      case 'help':
        printLine(`
[CORE]
  register [u] [p] - New Account
  login [u] [p]    - Access System
  story            - Read Lore Fragments (Level up to unlock more)
  
[ECONOMY]
  mine             - Mine ODZ (20s cooldown)
  decrypt          - Start Puzzle Minigame
  solve [word]     - Submit puzzle answer
  status           - View Profile
  clear            - Wipe screen
        `, 'info');
        break;

      case 'login': socket.emit('login', { username: args[1], password: args[2] }); break;
      case 'register': socket.emit('register', { username: args[1], password: args[2] }); break;
      case 'mine': socket.emit('mine'); break;
      
      // NEW COMMANDS
      case 'story': socket.emit('story'); break;
      case 'decrypt': socket.emit('decrypt'); break;
      case 'solve': socket.emit('solve', args[1]); break;
      
      case 'status':
        printLine(`USER: ${gameState.username} | LVL: ${gameState.level} | ODZ: ${gameState.balance}`, 'success');
        break;
      case 'clear': setOutput([]); break;
      default: printLine(`Unknown: ${command}`, 'error'); playSound('error');
    }
    setInput('');
  };

  return (
    <div className={`terminal-container theme-${gameState.theme || 'green'}`} onClick={() => document.querySelector('input').focus()}>
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
  );
}

export default App;
