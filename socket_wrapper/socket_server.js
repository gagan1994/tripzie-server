const { Server } = require('socket.io');

function setup_web_socket(server) {
    const io = new Server(server);

    io.on("connection", (socket) => {
        console.log("connected - " + socket);
        socket.on("position-change", (data) => {
            console.log("position change called with data - " + data);
            socket.broadcast.emit("position-change", data);
        })
        socket.on("disconnect", () => {
            console.log("socket disconnected - " + socket);
        });
    });

}

module.exports = { setup_web_socket };
