// src/utils/commandHandler.js

/**
 * Handles commands that can be processed entirely on the client side.
 * Returns an object with:
 * - handled: boolean (true if client processed it, false if server should)
 * - output: object (optional text/type to display)
 * - action: string (optional special action like 'clear' or 'logout')
 */
export const processClientCommand = (cmdString, gameState) => {
  const args = cmdString.trim().split(' ');
  const command = args[0].toLowerCase();

  switch (command) {
    case 'clear':
      return { handled: true, action: 'clear' };

    case 'logout':
      return { handled: true, action: 'logout' };

    case 'ping':
      // Simulated latency for immersion
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
        // Safe-ish eval for game flavor
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
  flip [h/t] [amt]        : Coinflip Wager

[HACKING & COMBAT]
  scan [target]           : Security Recon
  hack [target]           : Breach Protocol (30s)
  guess [pin]             : Decrypt PIN
  brute [target]          : Auto-Cracker (Requires Tool)

[MISSIONS]
  server_hack             : Raid Oddztek Mainframe
  nav [n/s/e/w]           : Navigate Virtual Space

[COMMUNICATION]
  chat [msg]              : Global encrypted channel
  mail check | read [id]  : Secure Inbox
  mail send [u] [msg]     : Send Encrypted Mail

[SYSTEM]
  files | read [f]        : File System Access
  sandbox [code]          : Local JS Environment
          `
        }
      };

    default:
      // If not handled here, return false so App.jsx sends it to the server
      return { handled: false };
  }
};