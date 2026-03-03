const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
const activeGroupCalls = {};
// userId → socketId
const userSocketMap = {};

function emitToUser(userId, event, payload) {
    if (userSocketMap[userId]) {
        userSocketMap[userId].forEach(socketId => {
            io.to(socketId).emit(event, payload);
        });
    }
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Register a userId to the socket.id
    socket.on("register", (userId) => {
        if (!userSocketMap[userId]) {
            userSocketMap[userId] = new Set();
        }
        userSocketMap[userId].add(socket.id);
        socket.userId = userId;
        console.log(`Registered userId ${userId} with socket ${socket.id}`);
    });

    
    // Handle outgoing call
    socket.on("call-user", ({ to, from, fromName, offer }) => {
        emitToUser(to, "incoming-call", { from, fromName, offer });
    });

    // Handle call answer
    socket.on("answer-call", ({ from, answer }) => {
        // `from` is the userId of the caller; forward the SDP answer back
        emitToUser(from, "answer-call", { answer });
        // optionally notify the caller that the call was answered
        emitToUser(from, "call-answered", null);
    });

    // Handle ICE candidates
    socket.on("ice-candidate", ({ to, candidate }) => {
        emitToUser(to, "ice-candidate", { candidate });
        // const targetSocketId = userSocketMap[to];
        // if (targetSocketId) {
        //     io.to(targetSocketId).emit("ice-candidate", { candidate });
        // }
    });

    // Handle hangup
    socket.on("hangup-call", ({ to }) => {
        emitToUser(to, "call-ended", null);

        // const targetSocketId = userSocketMap[to];
        // if (targetSocketId) {
        //     io.to(targetSocketId).emit("call-ended");
        // }
    });

    // Handle caller cancel before answering
    socket.on("cancel-call", ({ to }) => {
        emitToUser(to, "call-cancelled", null);

        // const targetSocketId = userSocketMap[to];
        // if (targetSocketId) {
        //     io.to(targetSocketId).emit("call-cancelled");
        // }
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        for (const userId in userSocketMap) {
            userSocketMap[userId].delete(socket.id);
            if (userSocketMap[userId].size === 0) {
                delete userSocketMap[userId];
            }
        }
    });

    // Handle group call
    socket.on("group-call", ({ groupId, fromUserId, toUserIds, groupName, participants }) => {
        toUserIds.forEach(userId => {
            if (userId !== fromUserId) {
                emitToUser(userId, "incoming-group-call", {
                    groupId,
                    fromUserId,
                    groupName,
                    participants
                })
                // const targetSocketId = userSocketMap[userId];
                // if (targetSocketId) {
                //     io.to(targetSocketId).emit("incoming-group-call", {
                //         groupId,
                //         fromUserId,
                //         groupName,
                //         participants
                //     });
                // }
            }
        });
    });

    // Handle group call cancel
    socket.on("cancel-group-call", ({ groupId, toUserIds }) => {
        toUserIds.forEach(userId => {
            emitToUser(userId, "group-call-cancelled", { groupId });
        });
    });


    // Handle user answering the group call
    socket.on("group-call-answered", ({ groupId, userId }) => {
        console.log(`User ${userId} answered call in group ${groupId}`);

        // Track participants
        if (!activeGroupCalls[groupId]) {
            activeGroupCalls[groupId] = {};
        }
        activeGroupCalls[groupId][userId] = 'answered';

        // Notify other users in group
        io.to(groupId).emit("group-call-user-answered", {
            userId,
            groupId
        });

    });

    // Handle user ignoring the call
    socket.on("group-call-ignored", ({ groupId, userId }) => {
        console.log(`User ${userId} ignored call in group ${groupId}`);

        if (!activeGroupCalls[groupId]) {
            activeGroupCalls[groupId] = {};
        }
        activeGroupCalls[groupId][userId] = 'ignored';

        // Notify other users in group
        io.to(groupId).emit("group-call-user-ignored", {
            userId,
            groupId,
        });
    });

    // Optionally: join room by groupId when call starts
    socket.on("join-group-room", (groupId) => {
        console.log(`User ${socket.userId} joined group room ${groupId} REQ`);
        socket.join(groupId);
    });

    socket.on("group-offer", ({ toUserId, fromUserId, groupId, offer }) => {
        emitToUser(toUserId, "group-offer", { fromUserId, offer, groupId });
    });
    socket.on("group-answer", ({ toUserId, fromUserId, groupId, answer }) => {
        emitToUser(toUserId, "group-answer", { fromUserId, answer, groupId });
    });
    socket.on("group-ice-candidate", ({ toUserId, fromUserId, groupId, candidate }) => {
        emitToUser(toUserId, "group-ice-candidate", { fromUserId, candidate, groupId });
    });
    socket.on("group-call-hangup", ({ groupId, fromUserId, toUserIds }) => {
        toUserIds.forEach(userId => {
            emitToUser(userId, "group-call-hangup", { groupId, fromUserId });
        });
    });

});

const PORT = 3001; // or 5000 or whatever port you prefer
server.listen(PORT, () => {
    console.log(`Socket.IO server running on http://lc:${PORT}`);
});