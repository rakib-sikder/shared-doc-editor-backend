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

  // token verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}



const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    profilePic: { type: String, default: "https://i.pravatar.cc/150" },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }
    
  },
  { timestamps: true }
);
const User = mongoose.model("User", UserSchema)

const database = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);
const Document = mongoose.model("Document", database);


const apiRouter = express.Router();
app.use('/api', apiRouter);

apiRouter.post("/signup",async (req,res)=>{
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
      expiresIn: "1d"});
      res.status(201).json(token);

  }
  catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }


})

apiRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    } 
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    } 
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    }); 
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
})


apiRouter.get("/documents", verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({ owner: req.userId }).populate("owner", "fullName profilePic");
    res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
})

apiRouter.post("/documents", verifyToken, async (req, res) => {
  const { title, content } = req.body;
  try {
    const newDocument = new Document({
      title,
      content,
      owner: req.userId,
    });
    await newDocument.save();
    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error creating document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

apiRouter.get("/documents/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const document = await Document.findById(id).populate("owner", "fullName profilePic");
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(200).json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
 