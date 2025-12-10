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

    // --- HELP MENU (Updated for v16.0) ---
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

[ECONOMY]
  mine                    : Data Mining (20s Cycle)
  daily                   : Loyalty Reward (24h)
  shop | buy [id]         : Black Market
  inventory | inv         : View Modules
  leaderboard             : Top Hackers
  transfer [u] [amt]      : Fund Transfer
  collect                 : Collect Passive Server Income

[BLACK MARKET]
  virus list              : View Custom Malware
  virus create [name]     : Compile new Virus (Costs 1000)
  virus upgrade [n] [stat]: Upgrade Power/Stealth
  bounty list             : View Most Wanted
  bounty place [u] [amt]  : Set price on a player's head

[HACKING OPERATIONS]
  netscan                 : Scan network for Targets
  scan [target]           : Recon specific target
  exploit [port] [virus]  : Breach via Port (Optional Virus)
  
  -- INSIDE SHELL --
  ls | cat [file]         : File Management
  privesc                 : Attempt Root Access (GPU Rec.)
  unlock [pin]            : Crack Wallet Encryption

[ACTIVITIES]
  flip [h/t] [amt]        : Coinflip Wager
  dice [1-6] [amt]        : Dice Roll (5x Payout)
  slots [amt]             : Slot Machine

[MISSIONS]
  jobs                    : List Contracts
  accept [id]             : Start Mission
  server_hack             : Start Heist (If active)
  nav [n/s/e/w]           : Mission Movement

[COMMUNICATION]
  chat [msg]              : Global encrypted channel
  mail check | read [id]  : Secure Inbox
  mail send [u] [msg]     : Send Encrypted Mail
          `
        }
      };

    default:
      // Pass through to Server
      return { handled: false };
  }
};
