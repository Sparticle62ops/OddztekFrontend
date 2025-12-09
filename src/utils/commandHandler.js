// src/utils/commandHandler.js

export const processClientCommand = (cmdString, gameState) => {
  const args = cmdString.trim().split(' ');
  const command = args[0].toLowerCase();

  switch (command) {
    // --- LOCAL UTILITIES ---
    case 'clear':
      return { handled: true, action: 'clear' };

    case 'logout':
      return { handled: true, action: 'logout' };

    case 'ping':
      const ms = Math.floor(Math.random() * 40 + 20);
      return { 
        handled: true, 
        output: { text: `Pong! Latency: ${ms}ms`, type: 'success' } 
      };

    case 'sandbox':
    case 'js':
      const code = args.slice(1).join(' ');
      if (!code) {
        return { 
          handled: true, 
          output: { text: 'Usage: sandbox [js_code]', type: 'error' } 
        };
      }
      try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${code})`)();
        return { 
          handled: true, 
          output: { text: `[JS]: ${result}`, type: 'success' } 
        };
      } catch (e) {
        return { 
          handled: true, 
          output: { text: `[JS Error]: ${e.message}`, type: 'error' } 
        };
      }

    // --- HELP MENU ---
    case 'help':
      return {
        handled: true,
        output: {
          type: 'info',
          text: `
[CORE SYSTEM]
  register [u] [p] (code) : Create Identity
  login [u] [p]           : Access Session
  status / whoami         : View Stats & Hardware
  logout | clear          : Session Management
  theme [name]            : UI Color (green, amber, plasma, matrix)
  ping                    : Network Diagnostic

[ECONOMY]
  mine                    : Data Mining (20s Cycle)
  daily                   : Loyalty Reward (24h)
  shop | buy [id]         : Black Market
  inventory | inv         : View Modules
  leaderboard             : Top Hackers
  transfer [u] [amt]      : Fund Transfer

[ACTIVITIES & GAMBLING]
  flip [h/t] [amt]        : Coinflip Wager
  dice [1-6] [amt]        : Dice Roll (5x Payout)
  slots [amt]             : Slot Machine

[HACKING OPERATIONS]
  scan [target]           : Recon target security level
  exploit [port]          : Breach specific port (NEW)
  privesc                 : Attempt Root Access (NEW)
  hack [target]           : Legacy Breach Protocol
  guess [pin]             : Decrypt PIN
  brute [target]          : Auto-Cracker (Requires Tool)

[MISSIONS & CONTRACTS]
  jobs                    : List Available Contracts
  accept [id]             : Accept Contract
  server_hack             : Raid Oddztek Mainframe
  nav [n/s/e/w]           : Navigate Virtual Space
  download                : Extract Mission Data

[COMMUNICATION]
  chat [msg]              : Global encrypted channel
  mail check | read [id]  : Secure Inbox
  mail send [u] [msg]     : Send Encrypted Mail

[SYSTEM]
  files | ls              : List System Directory
  read | cat [f]          : Decrypt/Display File
  sandbox [code]          : Local JS Environment
          `
        }
      };

    default:
      // Pass through to Server
      return { handled: false };
  }
};
