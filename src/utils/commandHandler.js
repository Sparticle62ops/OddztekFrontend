// src/utils/commandHandler.js

export const processClientCommand = (cmdString, gameState) => {
  const args = cmdString.trim().split(' ');
  const command = args[0].toLowerCase();

  switch (command) {
    // --- LOCAL UTILITIES ---
    case 'clear':
    case 'cls':
      return { handled: true, action: 'clear' };

    case 'logout':
    case 'exit':
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

    // --- HELP MENU (Revamped v17.0) ---
    case 'help':
    case '?':
      return {
        handled: true,
        output: {
          type: 'info',
          text: `
=== ODDZTEK SYSTEM COMMANDS ===

[IDENTITY & SYSTEM]
  register [user] [pass]  : Create new node identity
  login [user] [pass]     : Authenticate session
  whoami | status         : Display system/hardware stats
  logout | exit           : Terminate session
  theme [name]            : Change UI (green, amber, plasma, matrix)
  leaderboard             : View Global Ranking

[ECONOMY & MARKET]
  mine                    : Start crypto-mining cycle
  shop                    : Browse Black Market
  buy [item_id]           : Purchase hardware/software
  inv | inventory         : View owned assets
  transfer [user] [amt]   : Send funds
  collect                 : Harvest passive server income
  daily                   : Claim loyalty reward
  bank deposit [amt]      : Secure funds in vault
  bank withdraw [amt]     : Access vault funds
  combine [item]          : Craft upgraded software
  auction list            : Browse Player Auctions
  auction sell [item] [$] : List item for sale
  auction buy [id]        : Bid/Buy auction item

[OFFENSIVE OPERATIONS (v2.0)]
  netscan                 : Scan local subnet (NPCs/Players)
  scan [target]           : Analyze target security
  exploit [target]        : START INTRUSION SESSION
  probe                   : Check session status (Trace/Access)
  brute                   : Attack Firewall Integrity
  inject                  : Inject Payload (Gain Access)
  dc                      : Disconnect / Abort

[BLACK MARKET TOOLS]
  virus list              : View your compiled malware
  virus create [name]     : Compile new virus payload
  bounty list             : View active hit contracts
  bounty place [u] [amt]  : Set bounty on player

[MISSIONS & CONTRACTS]
  jobs                    : List available contracts
  accept [id]             : Sign contract
  mission start           : Begin active operation
  mission abort           : Cancel current job
  nav [n/s/e/w]           : Navigate neural maze
  download                : Exfiltrate data from target

[COMMUNICATION]
  chat [msg]              : Global encrypted broadcast
  mail list               : Check secure inbox
  mail read [id]          : Decrypt message
  mail send [u] [msg]     : Send encrypted packet
  invite                  : Generate recruitment code

[MINIGAMES]
  flip [h/t] [amt]        : Wager on quantum coin
  dice [1-6] [amt]        : Roll prediction
  slots [amt]             : Spin the wheel
          `
        }
      };

    default:
      // Pass through to Server
      return { handled: false };
  }
};
