let localStream;
let peerConnections = {};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = stream;
    })
    .catch((error) => console.error('Error accessing media devices:', error));

socket.on('user-joined', (userId) => {
    console.log('New user joined:', userId);
    createOffer(userId);
});

socket.on('signal', async ({ from, signal }) => {
    if (signal.type === 'offer') {
        await createAnswer(from, signal);
    } else if (signal.type === 'answer') {
        await peerConnections[from].setRemoteDescription(signal);
    } else if (signal.candidate) {
        await peerConnections[from].addIceCandidate(signal);
    }
});

async function createOffer(userId) {
    const peerConnection = createPeerConnection(userId);
    peerConnections[userId] = peerConnection;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('signal', { to: userId, signal: offer });
}

async function createAnswer(userId, offer) {
    const peerConnection = createPeerConnection(userId);
    peerConnections[userId] = peerConnection;

    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('signal', { to: userId, signal: answer });
}

function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection();

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { to: userId, signal: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        const video = document.getElementById(`remoteVideo-${userId}`) || createRemoteVideo(userId);
        video.srcObject = event.streams[0];
    };

    return peerConnection;
}

function createRemoteVideo(userId) {
    const remoteVideos = document.getElementById('remoteVideos');
    const video = document.createElement('video');
    video.id = `remoteVideo-${userId}`;
    video.autoplay = true;
    remoteVideos.appendChild(video);
    return video;
}

socket.on('user-left', (userId) => {
    console.log('User left:', userId);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
        const video = document.getElementById(`remoteVideo-${userId}`);
        if (video) video.remove();
    }
});
