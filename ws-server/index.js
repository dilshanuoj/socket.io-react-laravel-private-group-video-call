const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// userId → socketId
const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register a userId to the socket.id
  socket.on("register", (userId) => {
    userSocketMap[userId] = socket.id;
    console.log(`Registered userId ${userId} with socket ${socket.id}`);
  });

  // Handle outgoing call
  socket.on("call-user", ({ to, from, fromName, offer }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("incoming-call", {
        from,        // userId of caller
        fromName,
        offer
      });
      console.log(`Call request from user ${from} to ${to}`);
    } else {
      console.log(`User ${to} not connected or not registered`);
    }
  });

  // Handle call answer
  socket.on("answer-call", ({ from, answer }) => {
    const targetSocketId = userSocketMap[from]; // `from` is userId of caller
    if (targetSocketId) {
      io.to(targetSocketId).emit("answer-call", { answer });
      io.to(targetSocketId).emit("call-answered");
    }
  

  });

  // Handle ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { candidate });
    }
  });

  // Handle hangup
  socket.on("hangup-call", ({ to }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended");
    }
  });

  // Handle caller cancel before answering
  socket.on("cancel-call", ({ to }) => {
    const targetSocketId = userSocketMap[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-cancelled");
    }
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove the disconnected socket from the userSocketMap
    for (const userId in userSocketMap) {
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        break;
      }
    }
  });
});

server.listen(3001, () => {
  console.log("WebSocket server listening on port 3001");
});
