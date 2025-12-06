import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// --- CONNECTION SETUP ---
// REPLACE WITH YOUR ACTUAL RENDER BACKEND URL
const BACKEND_URL = "YOUR_RENDER_URL_HERE"; 

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    username: 'guest',
    balance: 0,
    xp: 0,
    level: 1,
    theme: 'green',
    inventory: []
  });

  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: 'ODDZTEK OS v4.0 (Sentient Update)', type: 'system' },
    { text: 'Initializing secure uplink...', type: 'system' },
  ]);
  const bottomRef = useRef(null);

  // --- INITIALIZE SOCKET ---
  useEffect(() => {
    if (!BACKEND_URL || BACKEND_URL.includes("YOUR_RENDER_URL")) {
      printLine("ERROR: Backend URL not configured in App.jsx", "error");
      return;
    }

    try {
      const newSocket = io(BACKEND_URL);
      setSocket(newSocket);

      newSocket.on('connect', () => {
        printLine('Connected to Mainframe.', 'success');
        printLine('Login required: login [username] [password]', 'info');
      });

      newSocket.on('connect_error', (err) => {
        printLine(`Connection Error: ${err.message}`, 'error');
      });

      newSocket.on('message', (msg) => {
        printLine(msg.text, msg.type);
      });

      newSocket.on('player_data', (data) => {
        setGameState(data);
      });

      return () => newSocket.close();
    } catch (err) {
      printLine(`Critical Socket Error: ${err.message}`, 'error');
    }
  }, []);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const printLine = (text, type = 'response') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const handleCommand = (cmd) => {
    const cleanCmd = cmd.trim();
    if (!cleanCmd) return;

    // Add user command to history
    const userPrompt = gameState.username || 'guest';
    setOutput(prev => [...prev, { text: `${userPrompt}@oddztek:~$ ${cleanCmd}`, type: 'command' }]);

    const args = cleanCmd.split(' ');
    const command = args[0].toLowerCase();

    if (!socket) {
      printLine("System Offline. Check configuration.", "error");
      setInput('');
      return;
    }

    switch (command) {
      case 'help':
        printLine(`
[SYSTEM COMMANDS]
  login [user] [pass]    - Login to system
  register [user] [pass] - Create new account
  passwd [new_pass]      - Change password (Required if hacked)
  logout                 - End session
  status                 - View stats & credits
  clear                  - Clear terminal

[ECONOMY]
  mine           - Run data mining algorithm (Earn ODZ)
  leaderboard    - View top hackers
  shop           - View Black Market
  buy [item]     - Purchase upgrades
  inv            - Check inventory

[HACKING OPERATIONS]
  hack [target]  - Start Breach Protocol (Mini-game)
  guess [number] - Input PIN guess during breach
        `, 'info');
        break;

      case 'login':
        if (args[1] && args[2]) socket.emit('login', { username: args[1], password: args[2] });
        else printLine('Usage: login [username] [password]', 'error');
        break;

      case 'register':
        if (args[1] && args[2]) socket.emit('register', { username: args[1], password: args[2] });
        else printLine('Usage: register [username] [password]', 'error');
        break;

      case 'passwd':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else if (args[1]) socket.emit('passwd', args[1]);
        else printLine('Usage: passwd [new_password]', 'error');
        break;

      case 'logout':
        setGameState({ username: 'guest', balance: 0, xp: 0, level: 1, theme: 'green' });
        printLine('Session terminated.', 'system');
        break;

      case 'mine':
        if (gameState.username === 'guest') printLine('Access Denied. Login required.', 'error');
        else socket.emit('mine');
        break;

      case 'leaderboard':
        socket.emit('leaderboard');
        break;

      case 'shop':
        socket.emit('shop');
        break;

      case 'buy':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else if (args[1]) socket.emit('buy', args[1]);
        else printLine('Usage: buy [item_name]', 'error');
        break;

      case 'inv':
      case 'inventory':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else printLine(`INVENTORY: ${gameState.inventory && gameState.inventory.length > 0 ? gameState.inventory.join(', ') : 'Empty'}`, 'info');
        break;

      case 'hack':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else if (args[1]) socket.emit('hack_init', args[1]);
        else printLine('Usage: hack [target_username]', 'error');
        break;

      case 'guess':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else if (args[1]) socket.emit('guess', args[1]);
        else printLine('Usage: guess [number]', 'error');
        break;

      case 'status':
        if (gameState.username === 'guest') printLine('Login required.', 'error');
        else {
          printLine(`
IDENTITY: ${gameState.username}
LEVEL: ${gameState.level}
CREDITS: ${gameState.balance} ODZ
EXP: ${gameState.xp}
THEME: ${gameState.theme}
          `, 'success');
        }
        break;

      case 'clear':
        setOutput([]);
        break;

      default:
        printLine(`Command not found: ${command}`, 'error');
    }
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCommand(input);
  };

  return (
    <div className={`terminal-container theme-${gameState.theme || 'green'}`}>
      <div className="scanline"></div>
      <div className="terminal-content">
        {output.map((line, index) => (
          <div key={index} className={`line ${line.type}`}>{line.text}</div>
        ))}
        <div className="input-line">
          <span className="prompt">{gameState.username || 'guest'}@oddztek:~$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck="false"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default App;