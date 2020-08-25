var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var btnJoin = document.querySelector('#btnJoin');
var btnLeave = document.querySelector('#btnLeave');
var localStream = null;
var socket = null;
var state = 'init';
var pc = null;
var dc = null;
var room = '';
var chat = document.querySelector('#chat');
var send = document.querySelector('#send');
var send_txt = document.querySelector('#send_txt');

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

// 获取本地音视频数据
function getMediaStream(stream) {
  localVideo.srcObject = stream;
  localStream = stream;
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

function join() {
  room = document.getElementById('room').value || '111111';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia is not supported!');
    return;
  } else {
    var constraints = {
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(getMediaStream)
      .then(
        // 连接信令服务器
        function () {
          conn();
        }
      )
      .catch((err) => {
        console.log(err);
        if (err.name === 'NotFoundError') {
          alert('未找到媒体设备');
        }
      });
  }
}

btnJoin.addEventListener('click', join);
btnLeave.addEventListener('click', leave);
