# socket.io-react-laravel-private-group-video-call
A real-time communication application that supports private and group video calls, built using Laravel (API backend), React (frontend), Socket.IO (signaling server), and WebRTC (peer-to-peer media streaming).

This project demonstrates scalable real-time architecture combining REST APIs and WebSocket-based signaling.

🚀 Features

📞 One-to-one private video calls

👥 Group video calls (multiple peer connections)

🔄 Real-time signaling using Socket.IO

🎥 WebRTC peer-to-peer media streaming

🔐 Authentication-based user sessions

📡 ICE candidate exchange & SDP handling

🟢 Online/offline user status

⚡ Live connection state management

🛠 Tech Stack

Backend API: Laravel

Frontend: React

Realtime Server: Node.js + Socket.IO

Media Streaming: WebRTC

Database: MySQL

Authentication: Laravel Sanctum / JWT

📡 Architecture Overview

Laravel handles authentication, users, and call metadata.

Socket.IO server manages signaling (offer, answer, ICE candidates).

WebRTC establishes direct peer-to-peer media streams.

React manages UI, call states, and peer connection lifecycle.

🎯 Purpose of This Project

Demonstrates real-time video communication architecture

Shows handling of multiple peer connections for group calls

Implements scalable signaling using Socket.IO

Explores WebRTC media track management and connection state handling

===============   Configure ==========================

run backend
php artisan serve

frontend 
npm start

wp-server
node server.js


run redis:
Open Command Prompt.
Navigate to the Redis installation directory (e.g., C:\Program Files\Redis\bin or wherever you installed).
Run:


You should see logs indicating Redis is running and listening on port 6379.
2. (Optional) Test Redis Connection
Open another Command Prompt and run:

redis-server
test: 
redis-cli ping

