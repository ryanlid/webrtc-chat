var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var btnJoin = document.querySelector('#btnJoin');
var btnLeave = document.querySelector('#btnLeave');
var localStream = null;
var socket = null;
var state = 'init';
var pc = null;
var room = '111111';

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

// 创建 Peer 连接
function createPeerConnection() {
  console.log('create RTCPeerConnection');
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

    // 将本地流加入 RTCPeerConnection
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }
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

    call();

    console.log('otherjoined message state: ', state);
  });

  socket.on('full', (roomid, socketid) => {
    console.log('full message : ', roomid, socketid);
    state = 'leaved';
    socket.disconnect();
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
    console.log('message message : ', roomid, data);

    // 媒体协商信息
    if (data) {
      console.log('message data: ', data);
      console.log(data.type);

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
