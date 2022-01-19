console.log('Hello guys');

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
        const data = JSON.parse(e.data);
        const peerUsername = data['peer'];
        const action = data['action'];

        if (username == peerUsername) {
            return;
        };

        var receiver_channel_name = data['message']['receiver_channel_name']

        if (action == 'new-peer') {
            createOfferer(peerUsername, receiver_channel_name);
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

    document.querySelector('#btn-send-msg').onclick = function(e) {
        const messageInputDom = document.querySelector('#msg');
        const message = messageInputDom.value;
        if (message.length > 0) {
            webSocket.send(JSON.stringify({
                'message': message,
            }));
            messageInputDom.value = '';
            document.getElementById('input-req').innerHTML = ''
        }
        else {
            document.getElementById('input-req').innerHTML = 'O campo acima precisa ser preenchido'
        }
    };
});

var localStream = new MediaStream();

const constraints = {
    'video': true,
    'audio': true,
};

const localVideo = document.querySelector('#local-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;
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

function createOfferer(peerUsername, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);
    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection opened like your mother');
    });
};

function addLocalTracks(peer){
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream)
    });
    return;
};