const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
// middleware 
app.use(cors());
app.use(express.json());
// mogodb connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully using Mongoose."))
  .catch((err) => console.error("MongoDB connection error:", err));

  //
const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    profilePic: { type: String, default: "https://i.pravatar.cc/150" },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);
const User = mongoose.model("User", UserSchema)




const apiRouter = express.Router();
app.use('/api', apiRouter);


apiRouter.post("",async (req,res)=>{
  const {fullName,email,password}= req.body
  try{
    const existingUser =await User.findOne({email});
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    user = new User({
      fullName,
      email,
      password: await bcrypt.hash(password, 10),
    });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

  }
  catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }


})


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
