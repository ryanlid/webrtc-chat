const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();

const MaximumInRoom = 2;

app.use(express.static('public'));

// http server
const http_server = http.createServer(app);

const io = socketio.listen(http_server);

io.sockets.on('connection', (socket) => {
  // socket 为每个客户端

  // 信令消息转发
  socket.on('signal', (room, data) => {
    // console.log('signal', room, data);
    socket.to(room).emit('signal', room, data);
  });

  socket.on('join', (room) => {
    // 将用户加入房间
    socket.join(room);

    const myRoom = io.sockets.adapter.rooms[room];

    // 获取房间用户数
    const users = Object.keys(myRoom.sockets).length;

    // 如果房间人数达到最大数量
    if (users <= MaximumInRoom) {
      socket.emit('joined', room, socket.id);

      // 第二个人加入
      if (users > 1) {
        socket.to(room).emit('otherjoined', room, socket.id);
      }
    } else {
      socket.leave(room);
      socket.emit('full', room, socket.id);
    }
  });

  socket.on('leave', (room) => {
    // 离开房间
    socket.leave(room);

    // 给房间除自己其他人发送
    socket.to(room).emit('leaved', room, socket.id);
  });
});

http_server.listen(3000);
