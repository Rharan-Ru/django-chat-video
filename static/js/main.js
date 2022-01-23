console.log('Hello guys');

var mapPeers = {};

var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');
var username;
var webSocket;

btnJoin.addEventListener('click', () => {
    username = usernameInput.value;
    console.log('username: ', username);
    if (username == ''){
        return;
    };

    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';

    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    var labelUsername = document.querySelector('#label-username');
    labelUsername.innerHTML = username;

    var loc = window.location;
    var wsStart = window.location.protocol == "https:" ? "wss://" : "ws://";

    var endPoint = wsStart + loc.host + loc.pathname;
    console.log(endPoint);

    webSocket = new WebSocket(endPoint);
    webSocket.addEventListener('open', (e) => {
        sendSignals('new-peer', {});
        console.log('Connection Open')
    });
    webSocket.addEventListener('close', (e) => {
        console.log('Connection Closed')
    });
    webSocket.addEventListener('error', (e) => {
        console.log('Error', e)
    });

    webSocket.onmessage = function(e) {
        var data = JSON.parse(e.data);
        if (data.receive_dict) {
            var peerUsername = data['receive_dict']['peer'];
            var action = data['receive_dict']['action'];
            var receiver_channel_name = data['receive_dict']['message']['receiver_channel_name'];
        };

        if (username == peerUsername) {
            return;
        };

        if (action == 'new-peer') {
            console.log("Create Offerer: ", peerUsername);
            createOfferer(peerUsername, receiver_channel_name);
            return;
        }
        if (action == 'new-offer') {
            console.log("Create Answear: ", peerUsername);
            var offer = data['receive_dict']['message']['sdp'];
            createAnswerer(offer, peerUsername, receiver_channel_name);
            return;
        }
        if (action == 'new-answer') {
            console.log("Set remote description for answear!: ", peerUsername);
            var answer = data['receive_dict']['message']['sdp'];
            var peer = mapPeers[peerUsername][0];
            peer.setRemoteDescription(answer);
            return;
        }
        if (data.msg) {
            console.log(data.msg);
            if (username === data.username) {
                $('#chat-log').append("<div class='m-0 mt-1 p-0'> <div class='row m-0 p-0'> <div class='col-12 m-0 p-0'> <p style='float-left' class='ms-2'> <strong>"+ data.username +"</strong></p></div><div class='container rounded ml-0 pl-0 perfil1' style=''> <p class='bg-dark float-left rounded text-card p-2' style='max-width:100%; min-width:15%'>"+ data.msg +"</p></div></div></div>")
            }
            else {
                $('#chat-log').append("<div class='m-0 mt-1 p-0 '> <div class='row m-0 p-0 text-warning'> <div class='col-12 m-0 p-0'> <p style='float-right' class='me-2'> <strong>"+ data.username +"</strong></p></div><div class='container rounded mr-0 pr-0 perfil1' style=''> <p class='bg-primary float-right rounded text-card p-2' style='max-width:100%;min-width:15%;'>"+ data.msg +"</p></div></div></div>")
            }
            var scroll = document.getElementById('position');
            scroll.scrollTop = scroll.scrollHeight;
        }
    };

    document.querySelector('#chat-message-input').focus();
    document.querySelector('#chat-message-input').onkeyup = function(e) {
        if (e.keyCode === 13) {  // enter, return
            document.querySelector('#chat-message-submit').click();
        }
    };

    document.querySelector('#chat-message-submit').onclick = function(e) {
        const messageInputDom = document.querySelector('#chat-message-input');
        const message = messageInputDom.value;
        if (message.length > 0) {
            webSocket.send(JSON.stringify({
                'chat-msg': message,
                'username': username,
            }));
            messageInputDom.value = '';
            document.getElementById('input-req').innerHTML = ''
        }
        else {
            document.getElementById('input-req').innerHTML = 'O campo acima precisa ser preenchido'
        }
    };
});

// Create new MediaStream for access webcam and microfone
//var localStream = new MediaStream();

// Constraints for userMedia
const constraints = {
    'video': true,
    'audio': true,
};

// Get local-video element
const localVideo = document.querySelector('#local-video');
const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');

// GetUserMedia and put strem on local-video
var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = stream.getAudioTracks();
        var videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = 'Audio Mute'
                return;
            };
            btnToggleAudio.innerHTML = 'Audio Unmute';
        });

        btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = 'Video Off'
                return;
            };
            btnToggleVideo.innerHTML = 'Video On';
        });
    })
    .catch(error => {
        console.log('Error accessing media devices.', error);
    })

// Function that send signnals to consumer
function sendSignals(action, message) {
    webSocket.send(JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    }));
};

function createOfferer(peerUsername, receiver_channel_name){
    const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
    var peer = new RTCPeerConnection(null);
    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection opened');
    });

    // Create new remote-video on frontend
    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    // If user is disconnected from ice-server close user peer and remove remote-video from frontend
    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];
            if (iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remoteVideo);
        };
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New ice candidate in offer');
            return;
        };
        sendSignals('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        });
    });

    peer.createOffer()
        .then(off => peer.setLocalDescription(off))
        .then(() => {
           console.log('Local description set susccesfully!');
        });
};

function createAnswerer(offer, peerUsername, receiver_channel_name) {
    const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};
    var peer = new RTCPeerConnection(null);
    addLocalTracks(peer);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log('Connection opened!');
        })

        mapPeers[peerUsername] = [peer, peer.dc];
    });

    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remoteVideo);
        };
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New ice candidate in answer: ', peerUsername);
            return;
        };
        sendSignals('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        });
    });

    peer.setRemoteDescription(offer)
        .then(() => {
           console.log('Remote description set susccesfully!');
           return peer.createAnswer();
        })
        .then(a => {
            console.log("Answear created");
            peer.setLocalDescription(a);
        });
};

function addLocalTracks(peer){
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
};

function createVideo(peerUsername){
    var videoContainer = document.querySelector('#video-container');

    var remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;

    var videoWrapper = document.createElement('div');

    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);
    return remoteVideo;
};

function setOnTrack(peer, remoteVideo){
    var remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream);
    });
};

function removeVideo(video){
    videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
};