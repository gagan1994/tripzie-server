const WebSocket = require('ws');

// Setup WebSocket server
function setup_web_socket(server) {
    CLIENTS = [];
    const wss = new WebSocket.Server({ server });
    // Event handler for new WebSocket connections
    wss.on('connection', function connection(ws) {
        CLIENTS.push(ws);
        console.log('New client connected ', CLIENTS.length);
        ws.on("disconnect", () => {
            console.log("socket disconnected - " + socket);
        });

        // Event handler for incoming messages
        ws.on('message', function incoming(message) {
            handleMessage(ws, message);
        });

        // Event handler for WebSocket closure
        ws.on('close', function close() {
            CLIENTS.pop(ws);
            console.log('Client disconnected ', CLIENTS.length);
            // Remove disconnected client from rooms
            for (const room_id in rooms) {
                if (rooms.hasOwnProperty(room_id)) {
                    const room = rooms[room_id];
                    for (const user_id in room) {
                        if (room.hasOwnProperty(user_id) && room[user_id] === ws) {
                            forwardMessageToRoom(room_id, ws, { user_id: user_id, type: 'user-left' })
                            delete room[user_id];
                        }
                    }
                }
            }
        });
    });
}
// Store connections and rooms
const connections = {};
var rooms = {};

// Function to send JSON message to a WebSocket
function sendMessage(ws, type, data) {
    ws.send(JSON.stringify({ type, data }));
}

function getKeyByValue(obj, value) {
    return Object.keys(obj)
        .filter(key => obj[key] === value);
}

// Function to handle incoming messages
function handleMessage(ws, message) {
    var data = JSON.parse(message);
    const { type, room_id, user_id } = data;
    switch (type) {
        case 'create-room':
            if (rooms[room_id] == null) {
                console.log("Creating new room");
                rooms[room_id] = {};
            } else {
                console.log("room already created joining");
            }
            rooms[room_id][user_id] = ws;
            forwardMessageToAllMembersInRoom(room_id)
            break;

        case 'join-room':
            rooms[room_id][user_id] = ws;
            console.log(`new user ${user_id} room_id: ${room_id} joined room total users: ${rooms[room_id].length}`);
            sendMessage(ws, 'joined-room', { room_id, user_id });
            forwardMessageToAllMembersInRoom(room_id)
            break;

        case 'start-meeting':
            if (rooms[room_id]) {
                var keys = []
                Object.values(rooms[room_id]).forEach(receiver => {
                    keys.push(getKeyByValue(rooms[room_id], receiver)[0]);
                });
                console.log(`users in room ${room_id} are: ${keys}`);
                for (let i = 0; i < keys.length; i++) {
                    var fromuser_id = keys[i];
                    var toUserList = [];
                    for (let j = i; j < keys.length; j++) {
                        if (i === j) continue;
                        var touser_id = keys[j];
                        toUserList.push(touser_id);
                    }
                    if (toUserList.length != 0) {
                        console.log(" Ask user " + fromuser_id + " to connect " + toUserList);
                        sendMessage(rooms[room_id][fromuser_id], 'invite', { "user_id": fromuser_id, "touser_ids": toUserList });
                    }
                }
            }
            break;
        case 'end-meeting':
            if (rooms[room_id]) {
                var keys = []
                Object.values(rooms[room_id]).forEach(receiver => {
                    keys.push(getKeyByValue(rooms[room_id], receiver)[0]);
                });
                console.log(`users in room ${room_id} are: ${keys}`);
                for (let i = 0; i < keys.length; i++) {
                    var fromuser_id = keys[i];
                    var toUserList = [];
                    for (let j = i; j < keys.length; j++) {
                        if (i === j) continue;
                        var touser_id = keys[j];
                        toUserList.push(touser_id);
                    }
                    if (toUserList.length != 0) {
                        console.log(" Ask user " + fromuser_id + " to end " + toUserList);
                        sendMessage(rooms[room_id][fromuser_id], 'end', { "user_id": fromuser_id, "touser_ids": toUserList });
                    }
                }
            }
            break;
        case 'ice-candidate':
            forwardMessageToRoom(room_id, ws, data);
            break;
        case 'offer':
            console.log(`${user_id} sending offer to :`);
            forwardMessageToRoom(room_id, ws, data);
            break;
        case 'answer':
            console.log(`${user_id} answered meeting with:`);
            forwardMessageToRoom(room_id, ws, data);
            break;
        case 'close':
            console.log(`${user_id} ended meeting with:`);
            forwardMessageToRoom(room_id, ws, data);
            Object.values(rooms[room_id]).forEach(receiver => {
                if (receiver !== ws) {
                    sendMessage(receiver, 'meeting-ended', audioData);
                }
            });
            rooms[room_id] = {};
            rooms = {};
            console.log(`clearing room data`); break
        case 'location-update':
            forwardMessageToRoom(room_id, ws, data);
            break;
        default:
            console.log('Unknown message type:', type);
    }
}
// Function to handle ICE candidates
function forwardMessageToRoom(room_id, sender, message) {
    const roomClients = rooms[room_id];
    if (roomClients)
        Object.keys(roomClients).forEach(function (key) {
            var client = roomClients[key];
            if (client !== sender) {
                client.send(JSON.stringify(message));
            }
        });

}
function forwardMessageToAllMembersInRoom(room_id) {
    const roomClients = rooms[room_id];
    if (roomClients)
        user_ids = Object.keys(roomClients);

    Object.keys(roomClients).forEach(function (key) {
        var client = roomClients[key];
        sendData = JSON.stringify({ type: "user-joined", user_id: user_ids });
        client.send(sendData);
    });

}

function handleIceCandidate(room_id, user_id, candidate) {
    // Broadcast ICE candidate to all other users in the room
    Object.keys(rooms[room_id]).forEach(function (key) {
        if (key !== user_id) {
            const otherUserConnection = rooms[room_id][key];
            if (otherUserConnection.readyState === WebSocket.OPEN) {
                console.log(`sending iceCandidate to ${key}`);
                otherUserConnection.send(JSON.stringify({
                    type: 'iceCandidate',
                    candidate: candidate
                }));
            }
        }
    });
}

module.exports = { setup_web_socket }