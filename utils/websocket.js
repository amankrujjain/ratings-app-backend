const WebSocket = require('ws');

// Singleton to allow importing WS functions from anywhere
let _notifyEmployee = null;
let _broadcastToAdmins = null;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Map();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const role = url.searchParams.get('role');

    if (clientId && role) {
      clients.set(clientId, { ws, role });
      console.log(`[WS] ${role} ${clientId} connected. Total: ${clients.size}`);
    } else {
      ws.close();
      return;
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] ${role} ${clientId} disconnected. Total: ${clients.size}`);
    });
    ws.on('error', (err) => console.error(`[WS] Error ${clientId}:`, err.message));
  });

  // Ping every 30s to detect dead connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => clearInterval(pingInterval));

  function notifyEmployee(employeeId, message) {
    const client = clients.get(employeeId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      console.log(`[WS] Sent to employee ${employeeId}`);
    }
  }

  function broadcastToAdmins(message) {
    let sent = 0;
    clients.forEach((client) => {
      if ((client.role === 'admin' || client.role === 'subadmin') && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        sent++;
      }
    });
    console.log(`[WS] Broadcast to ${sent} admin(s)`);
  }

  _notifyEmployee = notifyEmployee;
  _broadcastToAdmins = broadcastToAdmins;

  return { wss, notifyEmployee, broadcastToAdmins };
}

// Singleton getters — import from anywhere without circular deps
module.exports = setupWebSocket;
module.exports.getNotifyEmployee = () => _notifyEmployee;
module.exports.getBroadcastToAdmins = () => _broadcastToAdmins;