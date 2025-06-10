const express=require('express');
const cors=require('cors');
const mongoose=require('mongoose');
require('dotenv').config();
const http = require('http');
const {Server}= require('socket.io');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const PORT= process.env.PORT || 5000;


const app=express();
const server = http.createServer(app)

app.use(cors());
app.use(express.json());


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully using Mongoose.'))
  .catch((err) => console.error('MongoDB connection error:', err));







  server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
