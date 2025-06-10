const express=require('express');
const cors=require('cors');
const mongoose=require('mongoose');
require('dotenv').config();
const app=express();

const PORT= 5000;
app.use(cors());
app.use(express.json());


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully using Mongoose.'))
  .catch((err) => console.error('MongoDB connection error:', err));


  app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
