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
};

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    profilePic: { type: String, default: "https://i.pravatar.cc/150" },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);
const User = mongoose.model("User", UserSchema);

const database = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
        role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' }
    }]
  },
  { timestamps: true }
);
const Document = mongoose.model("Document", database);

const apiRouter = express.Router();
app.use("/api", apiRouter);

apiRouter.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the Shared Document Editor API" });
});

// signup route
apiRouter.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
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
    console.log("User created successfully:", user._id);
    res.status(201).json(token , user._id);
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// login route

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
      expiresIn: "1d",
    });
    res.status(200).json({ token,userId: user._id });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
// fetching all documents of a user
apiRouter.get("/documents", verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({ owner: req.userId }).populate(
      "owner",
      "fullName profilePic"
    );
    res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
// creating a new document
apiRouter.post("/documents", verifyToken, async (req, res) => {
  const { title, content } = req.body;
  console.log("new document created",req.userId);
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
//get spacific document by id
apiRouter.get("/documents/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const document = await Document.findById(id).populate(
      "owner",
      "fullName profilePic"
    );
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(200).json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// updating a document

apiRouter.put("/documents/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const updatedDocument = await Document.findByIdAndUpdate(
      id,
      { title, content },
      { new: true }
    ).populate("owner", "fullName profilePic");
    if (!updatedDocument) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.status(200).json(updatedDocument);
  } catch (error) {
    console.error("Error updating document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// sharing a document with another user
apiRouter.post("/documents/:id/share", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { email, role } = req.body;
  const userToShareWith = await User.findOne({ email: email });
  try {
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    } 
    if (document.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this document" });
    }
    if (!userToShareWith) {
      return res.status(404).json({ message: "User not found" });
    }
    const alreadyShared = document.sharedWith.some(
      (share) => share.user.toString() === userToShareWith._id.toString()
    );
    if (alreadyShared) {
      return res.status(400).json({ message: "Document already shared with this user" });
    }
    document.sharedWith.push({
      user: userToShareWith._id,
      role: role || "viewer", 
    }); 
    await document.save();
    res.status(200).json({ message: "Document shared successfully" })
  } catch (error) {
    console.error("Error sharing document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// get my shared with me documents
apiRouter.get("/shared-documents", verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({
      $or: [ { "sharedWith.user": req.userId }],
    })
      .populate("owner", "fullName profilePic") // Get details of the owner
      .sort({ updatedAt: -1 }); // Sort by most recently updated

    res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// delete a document
apiRouter.delete("/documents/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    } 
    if (document.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this document" });
    }
    await Document.findByIdAndDelete(id);
    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
);  

// socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*', // For production, change to your frontend URL
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-document', (docId) => {
    socket.join(docId);
    console.log(` joined room: ${docId}`);
  });

  socket.on('text-change', (delta, docId ) => {
    socket.to(docId).emit('receive-text-change', delta);
    console.log(`Text change in document ${docId} by ${socket.id}:`, delta);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});
server.listen(PORT, () => {

  console.log(`Server is running on http://localhost:${PORT}`);
});
