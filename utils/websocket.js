const WebSocket = require('ws');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  // Store connected clients
  const clients = new Map(); // Key: clientId (employeeId, adminId, etc.), Value: { ws, role }

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');

    // Extract clientId and role from query params (e.g., ws://localhost:8080?clientId=123&role=employee)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientId = url.searchParams.get('clientId');
    const role = url.searchParams.get('role'); // Possible values: 'employee', 'admin', 'subadmin'

    if (clientId && role) {
      clients.set(clientId, { ws, role });
      console.log(`${role} ${clientId} connected`);
    } else {
      console.log('Connection rejected: Missing clientId or role');
      ws.close();
    }

    ws.on('message', (message) => {
      console.log(`Received message: ${message}`);
    });

    ws.on('close', () => {
      if (clientId) {
        clients.delete(clientId);
        console.log(`${role} ${clientId} disconnected`);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error}`);
    });
  });

  // Notify a specific employee
  function notifyEmployee(employeeId, message) {
    const client = clients.get(employeeId);
    if (client && client.role === 'employee' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    } else {
      console.log(`Employee ${employeeId} is not connected`);
    }
  }

  // Broadcast to all admins and subadmins
  function broadcastToAdmins(message) {
    clients.forEach((client, clientId) => {
      if (
        (client.role === 'admin' || client.role === 'subadmin') &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(JSON.stringify(message));
        console.log(`Notification sent to ${client.role} ${clientId}`);
      }
    });
  }

  return { wss, notifyEmployee, broadcastToAdmins };
}

module.exports = setupWebSocket;