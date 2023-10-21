const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle file uploads (Rest API)
app.post('/upload/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const uploadedFile = req.files.file;
  const fileName = uploadedFile.name;
  const uploadDirectory = path.join(__dirname, 'uploads', roomId);

  // Create the directory if it doesn't exist
  fs.mkdirSync(uploadDirectory, { recursive: true });

  uploadedFile.mv(path.join(__dirname, 'uploads', roomId, fileName), (err) => {
    if (err) {
      console.error(err); // Log the error
      return res.status(500).send('Error: File upload failed');
    }
    io.to(roomId).emit('fileUploaded', { filename: fileName });

    // Update the list of files in the room
    if (!roomFiles[roomId]) {
      roomFiles[roomId] = [];
    }
    roomFiles[roomId].push(fileName);

    res.send('File uploaded!');
  });
});

// Manage users in rooms and list of files in rooms
const usersInRoom = {};
const roomFiles = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    io.to(roomId).emit('message', `Successfully connected to Room ${roomId}`);

    // Add the user to the list of users in the room
    usersInRoom[roomId] = usersInRoom[roomId] || [];
    usersInRoom[roomId].push(socket.id);

    // Emit the list of files to the user when they join
    if (roomFiles[roomId]) {
      socket.emit('fileList', roomFiles[roomId]);
    }

    const socketId = socket.id;
    io.to(roomId).emit('latestConnection', `User ${socket.id} joined the room.`);
    io.to(roomId).emit('userList', usersInRoom[roomId]);
    socket.emit('socketId', socketId);
  });

  socket.on('disconnect', () => {
    // Remove the user from the list of users in their room
    const rooms = Object.keys(socket.rooms);
    if (rooms.length > 1) {
      const roomId = rooms[1]; // The first room is always the user's own room
      const userIndex = usersInRoom[roomId].indexOf(socket.id);
      if (userIndex !== -1) {
        usersInRoom[roomId].splice(userIndex, 1);
        io.to(roomId).emit('userList', usersInRoom[roomId]);
      }
    }
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});






app.get('/download/:roomId/:filename', (req, res) => {
  const roomId = req.params.roomId;
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', roomId, filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath); // Trigger a file download
  } else {
    res.status(404).send('File not found');
  }
});