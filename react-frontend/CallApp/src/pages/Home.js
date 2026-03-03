import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { variables } from "../variables";

function Home() {
  const [users, setUsers] = useState([]);
  const socket = useRef(null);
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteAudioRef = useRef();
  const [callStatus, setCallStatus] = useState(null); // null | 'incoming' | 'calling' | 'answered'
  const [incomingCaller, setIncomingCaller] = useState(null); // { from, fromName, offer }
  const [myUserid, setUserId] = useState(null);
  const [callTargetUserId, setCallTargetUserId] = useState(null);
  const [activeCallUserId, setActiveCallUserId] = useState(null);
  const peers = {};
  const peerConnections = useRef({});
  const [remoteGroupStreams, setRemoteGroupStreams] = useState({}); // { userId: MediaStream }
  const groupPeerConnections = useRef({}); // { userId: RTCPeerConnection }
  const [pendingGroupOffers, setPendingGroupOffers] = useState([]);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const [activeGroupCall, setActiveGroupCall] = useState({
    group_id: null,
    participants: [
      // { id: 1, name: 'John Doe', socketId: 'socket-id-123',status: 'active / ringing / declined' }
    ],
    my_status: null, //incoming, active
    groupName: "",
  });


  const groups = [
    {
      id: 'g1',
      name: "Group 1",
      user_ids: [1, 2, 3],
    },
    {
      id: 'g2',
      name: "Group 2",
      user_ids: [1, 2],
    },
    {
      id: 'g3',
      name: "Group 3",
      user_ids: [1, 3],
    }
    ,
    {
      id: 'g4',
      name: "Group 4",
      user_ids: [2, 3],
    }
  ]

  async function getLoggedInUserId(socket1) {
    try {
      const response = await axios.get(variables.api + "/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      socket1.current.emit("register", response.data.id);
      setUserId(response.data.id);
      console.log("Registering user with ID:", response.data.id);
      return true
    } catch (error) {
      console.error("Failed to fetch logged-in user:", error);
      return null;
    }
  }

  useEffect(() => {
    // Connect to Socket.IO server
    socket.current = io(variables.socket);

    socket.current.on("connect", () => {
      console.log("Connected with socket id:", socket.current.id);

      // Register this user by ID after connecting
      getLoggedInUserId(socket); // get this from auth or token

    });

    axios.get(variables.api + "/users", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then(res => setUsers(res.data));

    socket.current.on("incoming-call", ({ from, fromName, offer }) => {
      console.log("Incoming call from:", from, "Name:", fromName);
      setIncomingCaller({ from, fromName, offer });
      setCallStatus("incoming");
    });



    socket.current.on("ice-candidate", async ({ candidate }) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(candidate);
      }
    });

    socket.current.on("answer-call", async ({ answer }) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus("answered");
    });

    // Fetch users here as you already do (axios call)...

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  async function answerCall() {
    setCallStatus("answered");
    if (!localStream.current) {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    }
    peerConnection.current = createPeerConnection();

    // localStream.current.getTracks().forEach(track =>
    //   peerConnection.current.addTrack(track, localStream.current)
    // );

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCaller.offer));

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket.current.emit("answer-call", {
      from: incomingCaller.from,
      answer: peerConnection.current.localDescription,
    });
    setActiveCallUserId(incomingCaller.from); // <-- new

    setIncomingCaller(null);
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream.current;
    }
    peerConnection.current.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
      // const videoElem = document.getElementById('call_video');
      // if (videoElem && event.streams[0].getVideoTracks().length > 0) {
      //   videoElem.srcObject = event.streams[0];
      // }
      console.log(event.streams)
      if (remoteVideoRef.current && event.streams[0].getVideoTracks().length > 0) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  }

  function cleanupCall() {
    console.log("Cleaning up call for target user:", callTargetUserId ? callTargetUserId : incomingCaller?.from, incomingCaller);

    if (callTargetUserId || incomingCaller?.from) {
      // Notify the server to end the call
      socket.current.emit("hangup-call", { to: callTargetUserId ? callTargetUserId : incomingCaller?.from });
    }

    if (activeCallUserId) {
      socket.current.emit("hangup-call", { to: activeCallUserId });
    }

    setCallStatus(null);
    setIncomingCaller(null);
    setCallTargetUserId(null);
    setActiveCallUserId(null); // reset


    setCallStatus(null);
    setIncomingCaller(null);
    setCallTargetUserId(null);  // Reset call target user id

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }

  async function setupGroupPeerConnections(participants) {
    if (!localStream.current) {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    }
    participants.forEach(async (participant) => {
      if (participant.id === myUserid) return; // Skip self

      // Avoid duplicate connections
      if (groupPeerConnections.current[participant.id]) return;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      console.log("Creating peer connection for participant:", participant.id);
      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current.emit("group-ice-candidate", {
            toUserId: participant.id,
            fromUserId: myUserid,
            groupId: activeGroupCall.group_id,
            candidate: event.candidate,
          });
        }
      };


      pc.ontrack = (event) => {
        // const videoElem = document.getElementById('call_video');
        // if (videoElem && event.streams[0].getVideoTracks().length > 0) {
        //   videoElem.srcObject = event.streams[0];
        // }
        console.log(event.streams, ' streams')
        // if (remoteVideoRef.current && event.streams[0].getVideoTracks().length > 0) {
        //   remoteVideoRef.current.srcObject = event.streams[0];
        // }
        console.log('ontrack event3:', event.streams[0], event.streams[0].getVideoTracks().length);
        console.log("Remote stream received for participant:", participant.id);
        setRemoteGroupStreams(prev => ({
          ...prev,
          [participant.id]: event.streams[0]
        }));
      };

      // Add local audio
      localStream.current.getTracks().forEach(track => {
        console.log("Adding track", track);
        pc.addTrack(track, localStream.current);
      });

      groupPeerConnections.current[participant.id] = pc;

      // If you are the initiator, create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.current.emit("group-offer", {
        toUserId: participant.id,
        fromUserId: myUserid,
        groupId: activeGroupCall.group_id,
        offer,
      });

    });
  }

  useEffect(() => {
    if (!socket.current) return;

    // Receive offer
    // In your "group-offer" handler:
    socket.current.on("group-offer", ({ fromUserId, offer, groupId }) => {
      setPendingGroupOffers(prev => [...prev, { fromUserId, offer, groupId }]);
    });

    // Receive answer
    socket.current.on("group-answer", async ({ fromUserId, answer }) => {
      if (groupPeerConnections.current[fromUserId]) {
        await groupPeerConnections.current[fromUserId].setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Receive ICE candidate
    socket.current.on("group-ice-candidate", async ({ fromUserId, candidate }) => {
      if (groupPeerConnections.current[fromUserId]) {
        await groupPeerConnections.current[fromUserId].addIceCandidate(candidate);
      }
    });

    return () => {
      socket.current.off("group-offer");
      socket.current.off("group-answer");
      socket.current.off("group-ice-candidate");
    };
  }, [activeGroupCall.group_id, myUserid]);


  function cancelCall() {
    if (incomingCaller?.from) {
      socket.current.emit("cancel-call", { to: incomingCaller.from });
    }
    cleanupCall();
  }



  function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current.emit("ice-candidate", {
          to: callTargetUserId || incomingCaller?.from,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('ontrack event2:', event.streams[0], event.streams[0].getVideoTracks().length);

      console.log("Remote stream received for call target:", callTargetUserId || incomingCaller?.from);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
      // if (localVideoRef.current && localStream.current) {
      //   localVideoRef.current.srcObject = localStream.current;
      // }
      // if (remoteVideoRef.current && event.streams[0].getVideoTracks().length > 0) {
      //   remoteVideoRef.current.srcObject = event.streams[0];
      // }
      // const videoElem = document.getElementById('call_video');
      // if (videoElem && event.streams[0].getVideoTracks().length > 0) {
      //   videoElem.srcObject = event.streams[0];
      // }
    };


    return pc;
  }

  async function startCall(user) {
    setCallStatus("calling");
    setCallTargetUserId(user.id);  // Store target user id
    setActiveCallUserId(user.id); // <-- new

    if (!localStream.current) {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      console.log('making call', localStream)
      console.log('localStream tracks:', localStream.current.getTracks());
      console.log('video tracks:', localStream.current.getVideoTracks());

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    }
    peerConnection.current = createPeerConnection();

    // localStream.current.getTracks().forEach(track =>
    //   peerConnection.current.addTrack(track, localStream.current)
    // );

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socket.current.emit("call-user", {
      to: user.id,
      from: myUserid,
      fromName: "YourNameHere",
      offer,
    });
    console.log("Call initiated to:", user.id);
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream.current;
    }
  }


  function cancelOutgoingCall() {
    if (callTargetUserId) {
      socket.current.emit("cancel-call", { to: callTargetUserId });
    }
    cleanupCall();
  }


  // function cancelCall() {
  //   cleanupCall();
  //   // Optionally notify remote side if needed
  // }

  useEffect(() => {
    socket.current.on("call-ended", () => {
      cleanupCall();
    });

    socket.current.on("call-answered", () => {
      setCallStatus("answered");
    });

    return () => {
      socket.current.off("call-ended");
      socket.current.off("call-answered");
    };
  }, []);

  useEffect(() => {
    socket.current.on("call-cancelled", () => {
      console.log("Call was cancelled by the other party.");
      cleanupCall();
    });
  }, []);
  const localAudioRef = useRef();

  const handleMakeGroupCall = async (groupId, userIds) => {
    console.log("Making group call to group ID:", groupId, "with users:", userIds);

    socket.current.emit("join-group-room", groupId);
    const groupName = `Group ${groupId}`;
    let participants = userIds.map(id => ({
      id,
      name: `User ${id}`,
      socketId: `socket-id-${id}`,
      status: id == myUserid ? 'active' : 'ringing'
    }));
    setActiveGroupCall({
      group_id: groupId,
      participants: participants,
      my_status: 'active',
      groupName: groupName,
    });

    socket.current.emit("group-call", {
      groupId,
      fromUserId: myUserid,
      toUserIds: userIds,
      groupName,
      participants
    });

    await setupGroupPeerConnections(participants);
  };

  function cleanupGroupCall() {
    Object.values(groupPeerConnections.current).forEach(pc => pc.close());
    groupPeerConnections.current = {};
    setRemoteGroupStreams({});
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }
  const cancelGroupCall = (groupId) => {
    console.log("Cancelling group call for group ID:", groupId);

    // Emit a hangup event to all group members
    socket.current.emit("group-call-hangup", {
      groupId,
      fromUserId: myUserid,
      toUserIds: activeGroupCall.participants.map(p => p.id),
    });

    cleanupGroupCall();

    setActiveGroupCall({
      group_id: null,
      participants: [],
      my_status: null,
      groupName: "",
    });
  };

  const handleAnswerGroupCall = async () => {
    setActiveGroupCall(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === myUserid ? { ...p, status: 'active' } : p
      ),
      my_status: 'active',
    }));
    socket.current.emit("join-group-room", activeGroupCall.group_id);
    socket.current.emit("group-call-answered", {
      groupId: activeGroupCall.group_id,
      userId: myUserid,
    });

    // Process all pending offers
    for (const { fromUserId, offer, groupId } of pendingGroupOffers) {
      if (!groupPeerConnections.current[fromUserId]) {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.current.emit("group-ice-candidate", {
              toUserId: fromUserId,
              fromUserId: myUserid,
              groupId,
              candidate: event.candidate,
            });
          }
        };
        pc.ontrack = (event) => {
          console.log('ontrack event1:', event.streams[0], event.streams[0].getVideoTracks().length);

          // if (remoteVideoRef.current && event.streams[0].getVideoTracks().length > 0) {
          //   remoteVideoRef.current.srcObject = event.streams[0];
          // }

          setRemoteGroupStreams(prev => ({
            ...prev,
            [fromUserId]: event.streams[0]
          }));
        };

        if (!localStream.current) {
          localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream.current;
          }
        }
        localStream?.current?.getTracks().forEach(track => pc.addTrack(track, localStream.current));
        groupPeerConnections.current[fromUserId] = pc;

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.current.emit("group-answer", {
          toUserId: fromUserId,
          fromUserId: myUserid,
          groupId,
          answer,
        });
      }
    }
    setPendingGroupOffers([]); // Clear after processing

    // Also initiate your own connections to others as before
    await setupGroupPeerConnections(activeGroupCall.participants);
  };

  const handleIgnoreGroupCall = () => {
    socket.current.emit("group-call-ignored", {
      groupId: activeGroupCall.group_id,
      userId: myUserid,
    });

    setActiveGroupCall({
      group_id: null,
      participants: [],
      my_status: null,
      groupName: "",
    });
  };

  useEffect(() => {
    if (!socket.current) return;

    socket.current.on("group-call-hangup", ({ groupId, fromUserId }) => {
      if (activeGroupCall.group_id === groupId) {
        cleanupGroupCall();
        setActiveGroupCall({
          group_id: null,
          participants: [],
          my_status: null,
          groupName: "",
        });
      }
    });

    return () => {
      socket.current.off("group-call-hangup");
    };
  }, [activeGroupCall.group_id]);

  useEffect(() => {
    if (!socket.current) return;

    socket.current.on("group-call-user-answered", ({ userId, groupId }) => {
      console.log(`User ${userId} answered the group call`);
      setActiveGroupCall(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.id === userId ? { ...p, status: 'active' } : p
        )
      }));
    });

    socket.current.on("group-call-user-ignored", ({ userId, groupId }) => {
      console.log(`User ${userId} ignored the group call`);

      setActiveGroupCall(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.id === userId ? { ...p, status: 'ignored' } : p
        )
      }));
    });

    return () => {
      socket.current.off("group-call-user-answered");
      socket.current.off("group-call-user-ignored");
    };
  }, []);


  useEffect(() => {
    socket.current.on("incoming-group-call", ({ groupId, fromUserId, groupName, participants }) => {
      console.log("Incoming group call to group", groupId);

      // Get the full group user list from your existing groups array
      const group = groups.find(g => g.id === groupId);
      const pts = participants.map(p => ({
        id: p.id,
        name: p.name,
        socketId: p.socketId,
        status: p.id === myUserid ? 'incoming' : p.status || 'ringing'
      })) || [];

      setActiveGroupCall({
        group_id: groupId,
        participants: pts,
        my_status: "incoming",
        groupName,
      });
    });


    socket.current.on("group-call-cancelled", ({ groupId }) => {
      console.log("Group call cancelled for group", groupId);
      if (activeGroupCall.group_id === groupId) {
        setActiveGroupCall({
          group_id: null,
          participants: [],
          my_status: null,
          groupName: "",
        });
      }
    });
  }, [activeGroupCall.group_id, myUserid]);

  function AudioPlayer({ stream }) {
    const ref = useRef();
    useEffect(() => {
      if (ref.current && stream) {
        ref.current.srcObject = stream;
      }
    }, [stream]);
    return <audio ref={ref} autoPlay />;
  }


  // useEffect(() => {
  //   let ele = document.getElementById('video');
  //   if (ele) {
  //     navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  //       document.getElementById('video').srcObject = stream;
  //     }).catch(e => alert(e));
  //   }
  // }, [])
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Available Users</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Call</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <button onClick={() => startCall(user)}>Call</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <audio ref={localAudioRef} autoPlay muted /> {/* optional for echo */}
      <audio ref={remoteAudioRef} autoPlay />

      {Object.entries(remoteGroupStreams).map(([userId, stream]) => (
        <div key={userId}>
          <AudioPlayer stream={stream} />
        </div>
      ))}
      {
        JSON.stringify(remoteGroupStreams)
      }
      <video ref={localVideoRef} autoPlay playsInline muted style={{ width: 200, height: 150, background: '#000' }} />

      {Object.entries(remoteGroupStreams).map(([userId, stream]) => (
        <div key={userId} style={{ marginBottom: 20 }}>
          <p>Remote User {userId}</p>
          <video
            autoPlay
            playsInline
            ref={el => {
              if (el && stream) el.srcObject = stream;
            }}
            style={{ width: 200, height: 150, background: "#000" }}
          />
        </div>
      ))}




      {
        groups.filter(group => group.user_ids.includes(myUserid)).map(group => (
          <div key={group.id} style={{ marginTop: "20px", border: "1px solid #ccc", padding: "10px" }}>
            <h3>{group.name}</h3>
            <button onClick={() => {
              handleMakeGroupCall(group.id, group.user_ids);
            }}>Start Group Call</button>
          </div>
        ))
      }
      {
        activeGroupCall.group_id && (
          <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "10px" }}>
            <h3>Active Group Call: {activeGroupCall.groupName}</h3>
            <p>Status: {activeGroupCall.my_status}</p>
            <ul>
              {activeGroupCall.participants.map(participant => (
                <li key={participant.id}>
                  {participant.name} - {participant.status}
                </li>
              ))}
            </ul>
            <button onClick={() => {
              // Handle group call hangup logic here
              cancelGroupCall(activeGroupCall.group_id);

            }}>Hang Up Group Call</button>
          </div>
        )
      }
      {activeGroupCall.my_status === "incoming" && (
        <div className="incoming-call-ui">
          <h3>{activeGroupCall.groupName} is calling...</h3>
          <button onClick={handleAnswerGroupCall}>Answer</button>
          <button onClick={handleIgnoreGroupCall}>Ignore</button>
        </div>
      )}



      {callStatus === "incoming" && incomingCaller && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#eee", padding: "1rem", display: "flex", justifyContent: "space-around", alignItems: "center",
          borderTop: "1px solid #ccc"
        }}>
          <span>Incoming call from {incomingCaller.fromName}</span>
          <button onClick={answerCall}>Answer</button>
          <button onClick={cancelCall}>Cancel</button>
        </div>
      )}

      {callStatus === "calling" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#eee", padding: "1rem", display: "flex", justifyContent: "space-around", alignItems: "center",
          borderTop: "1px solid #ccc"
        }}>
          <span>Ringing...</span>
          <button onClick={cancelOutgoingCall}>Cancel</button>
        </div>
      )}

      {callStatus === "answered" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#eee", padding: "1rem", display: "flex", justifyContent: "space-around", alignItems: "center",
          borderTop: "1px solid #ccc"
        }}>
          <span>Call connected</span>
          <button onClick={cleanupCall}>Hang up</button>
        </div>
      )}



    </div>
  );
}

export default Home; 