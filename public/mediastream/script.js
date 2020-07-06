var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var btnJoin = document.querySelector('#btnJoin');
var btnLeave = document.querySelector('#btnLeave');
var localStream = null;
var socket = null;
var state = 'init';
var pc = null;
var dc = null;
var room = '111111';
var chat = document.querySelector('#chat');
var send = document.querySelector('#send');
var send_txt = document.querySelector('#send_txt');

send.onclick = function () {
  sendText();
};
function sendSignal(roomid, data) {
  if (socket) {
    socket.emit('signal', roomid, data);
  }
}

// 关闭 peer 连接
function closePeerConnection() {
  if (pc) {
    pc.close();
    pc = null;
  }
}
// 关闭本地媒体
function closeLocalMedia() {
  if (localStream && localStream.getTracks()) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
  }
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
  localStream = null;
}

// 用户点击离开
function leave() {
  if (socket) {
    socket.emit('leave', room);
  }
  // 关闭p2p连接
  closePeerConnection();
  // 关闭本地音视频资源
  closeLocalMedia();
}

function getAnswer(desc) {
  console.log('getAnswer: ', desc);
  pc.setLocalDescription(desc);
  sendSignal(room, desc);
}
function handlerAnserError(err) {
  console.error('handlerAnserError: ', err);
}
// 收到 Offer
function getOffer(desc) {
  pc.setLocalDescription(desc);
  sendSignal(room, desc);
}
function handleOfferError(err) {
  console.log('handleOfferError: ', err);
}

// 只能发起端调用
function call() {
  if (state === 'joined_conn') {
    if (pc) {
      var options = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      };
      pc.createOffer(options).then(getOffer).catch(handleOfferError);
    }
  }
}

function recevemsg(e) {
  var msg = e.data;
  console.log('receives ', msg);
  if (msg) {
    chat.value += '--->' + msg + '\r\n';
  } else {
    console.error('receives msg is null');
  }
}

function sendText() {
  var data = send_txt.value;
  console.log('send', data);
  if (data) {
    dc.send(data);
    send_txt.value = '';
    chat.value += '<- ' + data + '\r\n';
  }
}

function dataChannelStateChange(e) {
  var readyState = dc.readyState;
  if (readyState === 'open') {
    send_txt.disabled = false;
    send.disabled = false;
  } else if (readyState == 'close') {
    send_txt.disabled = true;
    send.disabled = true;
  }
}

// 创建 Peer 连接
function createPeerConnection() {
  console.log('create RTCPeerConnection', pc);
  if (!pc) {
    var config = {
      iceServers: [
        {
          urls: ['stun:stun.oonnnoo.com:3478'],
        },
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: '0',
    };
    pc = new RTCPeerConnection(config);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        // console.log('find a new candidate ', e.candidate);
        // 发送 candidate 信息
        sendSignal(room, {
          type: 'candidate',
          label: e.candidate.sdpMLineIndex,
          id: e.candidate.sdpMid,
          candidate: e.candidate.candidate,
        });
      }
    };
    pc.ontrack = (e) => {
      console.log('track:', e);
      remoteVideo.srcObject = e.streams[0];
      // remoteVideo.srcObject = new MediaStream([e.track]);
    };
    pc.ondatachannel = (e) => {
      console.log(e);
      console.log('dadadada', dc);
      if (!dc) {
        dc = e.channel;
        dc.onmessage = recevemsg;
        dc.onopen = dataChannelStateChange;
        dc.onclose = dataChannelStateChange;
      }
    };

    // 将本地流加入 RTCPeerConnection
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }
  } else {
    console.log('the pc has created');
  }
}

// 连接信令服务器
function conn() {
  socket = io.connect();
  socket.on('joined', (roomid, socketid) => {
    console.log('joined message : ', roomid, socketid);
    state = 'joined';
    createPeerConnection();
  });

  socket.on('otherjoined', (roomid, socketid) => {
    console.log('otherjoined message : ', roomid, socketid);

    if (state === 'joined_unbind') {
      // 创建连接绑定
      createPeerConnection();
    }
    state = 'joined_conn';

    dc = pc.createDataChannel('chat', {});
    dc.onmessage = recevemsg;
    dc.onopen = dataChannelStateChange;
    dc.onclose = dataChannelStateChange;
    call();

    console.log('otherjoined message state: ', state, dc);
  });

  socket.on('full', (roomid, socketid) => {
    console.log('full message : ', roomid, socketid);
    state = 'leaved';
    socket.disconnect();
    closeLocalMedia();
    alert('该房间已满');
  });

  socket.on('leaved', (roomid, socketid) => {
    console.log('leaved message : ', roomid, socketid);
    state = 'leaved';
    socket.disconnect();
  });

  socket.on('bye', (roomid, socketid) => {
    console.log('bye message : ', roomid, socketid);
    state = 'joined_unbind';
    // 关闭p2p连接
    // closePeerConnection();
  });

  // 收到媒体协商信令消息
  socket.on('signal', (roomid, data) => {
    // console.log('message message : ', roomid, data);

    // 媒体协商信息
    if (data) {
      if (data.type === 'offer') {
        // 被呼叫方
        pc.setRemoteDescription(new RTCSessionDescription(data));
        pc.createAnswer().then(getAnswer).catch(handlerAnserError);
      } else if (data.type === 'answer') {
        // 呼叫方
        pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.type === 'candidate') {
        var candidate = new RTCIceCandidate({
          sdpMLineIndex: data.label,
          candidate: data.candidate,
        });
        pc.addIceCandidate(candidate);
      } else {
        console.error('the message is invalid');
      }
    }
  });

  socket.emit('join', room);
}

// 获取本地音视频数据
function getMediaStream(stream) {
  localVideo.srcObject = stream;
  localStream = stream;
  conn();
}

function join() {
  room = document.getElementById('room').value || '111111';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia is not supported!');
    return;
  } else {
    var constraints = {
      // video: true,
      // audio: true

      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(getMediaStream)
      .catch((err) => {
        console.log(err);
      });
  }
}

btnJoin.addEventListener('click', join);
btnLeave.addEventListener('click', leave);
