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
        var peerUsername = data['receive_dict']['peer'];
        var action = data['receive_dict']['action'];

        if (username == peerUsername) {
            return;
        };

        var receiver_channel_name = data['receive_dict']['message']['receiver_channel_name'];
        if (action == 'new-peer') {
            createOfferer(peerUsername, receiver_channel_name);
            return;
        }
        if (action == 'new-offer') {
            var offer = data['receive_dict']['message']['sdp'];
            createAnswerer(offer, peerUsername, receiver_channel_name);
            return;
        }
        if (action == 'new-answer') {
            var answer = data['receive_dict']['message']['sdp'];
            var peer = mapPeers[peerUsername][0];
            peer.setRemoteDescription(answer);
            return;
        }
//        console.log(data.message);
//
//        var today = new Date();
//        var messageContainer = document.querySelector('#message-list');
//        var li = document.createElement("li");
//        li.innerHTML = '[' + username + ' | ' + today.toLocaleTimeString() + ']: ' + '['+data.message+']';
//        messageContainer.prepend(li);
    };

//    document.querySelector('#btn-send-msg').onclick = function(e) {
//        const messageInputDom = document.querySelector('#msg');
//        const message = messageInputDom.value;
//        if (message.length > 0) {
//            webSocket.send(JSON.stringify({
//                'message': message,
//            }));
//            messageInputDom.value = '';
//            document.getElementById('input-req').innerHTML = ''
//        }
//        else {
//            document.getElementById('input-req').innerHTML = 'O campo acima precisa ser preenchido'
//        }
//    };
});

// Create new MediaStream for access webcam and microfone
var localStream = new MediaStream();

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

function sendSignals(action, message) {
    webSocket.send(JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    }));
};

function createOfferer(peerUsername, receiver_channel_name){
    var peer = new RTCPeerConnection(null);
    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection opened');
    });
    dc.addEventListener('message', dcOnMessage);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectiondatachange', () => {
        console.log('ice');
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed'){
                peer.close();
            };
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New candidate: ', JSON.stringify(peer.localDescription));
            return;
        };

        sendSignals('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        })
    })

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
           console.log('Local description set susccesfully!');
        })
}

function createAnswerer(offer, peerUsername, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);
    addLocalTracks(peer);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log('Connection opened like your mother');
        })
        peer.dc.addEventListener('message', dcOnMessage);

        mapPeers[peerUsername] = [peer, peer.dc];
    })

    peer.addEventListener('iceconnectiondatachange', () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if(event.candidate){
            console.log('New candidate');
            return;
        }
        sendSignals('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        });
    })

    peer.setRemoteDescription(offer)
        .then(() => {
           console.log('Remote description set susccesfully! for: ', peerUsername);

           return peer.createAnswer();
        })
        .then(a => {
            console.log("Answear created ");
            peer.setLocalDescription(a);
        })
};

function addLocalTracks(peer){
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
};

function dcOnMessage(event){
    var today = new Date();
    var messageContainer = document.querySelector('#message-list');
    var li = document.createElement("li");
    li.innerHTML = '[' + username + ' | ' + today.toLocaleTimeString() + ']: ' + '['+event.data+']';
    messageContainer.prepend(li);
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
}

function setOnTrack(peer, remoteVideo){
    var remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (event) => {
        console.log('seted');
        remoteStream.addTrack(event.track, remoteStream);
    });
};

function removeVideo(video){
    videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
};