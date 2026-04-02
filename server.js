import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ========= DATABASE ========= */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("DB CONNECTED"))
.catch(err=>console.log(err));

/* ========= MODELS ========= */
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  favorites: [String]
});

const MessageSchema = new mongoose.Schema({
  user: String,
  text: String,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);

/* ========= AUTH ========= */
function auth(req,res,next){
  const token = req.headers.authorization;

  if(!token) return res.status(401).json({msg:"No token"});

  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  }catch{
    res.status(401).json({msg:"Invalid token"});
  }
}

/* ========= REGISTER ========= */
app.post("/api/register", async (req,res)=>{
  const {username,password} = req.body;

  if(!username || !password)
    return res.json({success:false});

  const exists = await User.findOne({username});
  if(exists) return res.json({success:false});

  const hash = await bcrypt.hash(password,10);

  await User.create({username,password:hash,favorites:[]});

  res.json({success:true});
});

/* ========= LOGIN ========= */
app.post("/api/login", async (req,res)=>{
  const {username,password} = req.body;

  const user = await User.findOne({username});
  if(!user) return res.json({success:false});

  const ok = await bcrypt.compare(password,user.password);
  if(!ok) return res.json({success:false});

  const token = jwt.sign(
    {id:user._id,username:user.username},
    process.env.JWT_SECRET,
    {expiresIn:"7d"}
  );

  res.json({success:true,token});
});

/* ========= FAVORITES ========= */
app.post("/api/fav", auth, async (req,res)=>{
  const {team} = req.body;

  await User.findByIdAndUpdate(req.user.id,{
    $addToSet:{favorites:team}
  });

  res.json({success:true});
});

app.get("/api/fav", auth, async (req,res)=>{
  const user = await User.findById(req.user.id);
  res.json(user.favorites);
});

/* ========= CHAT ========= */
app.post("/api/chat", auth, async (req,res)=>{
  await Message.create({
    user:req.user.username,
    text:req.body.text
  });

  res.json({success:true});
});

app.get("/api/chat", async (req,res)=>{
  const msgs = await Message.find().sort({time:-1}).limit(20);
  res.json(msgs);
});

/* ========= AI ========= */
app.post("/api/predict", (req,res)=>{
  const r = Math.random();
  let result = "Draw";

  if(r > 0.6) result = "Home Win";
  if(r < 0.3) result = "Away Win";

  res.json({prediction:result});
});

/* ========= MATCHES ========= */
app.get("/api/matches", async (req,res)=>{
  try{
    const r = await fetch("https://api.football-data.org/v4/matches",{
      headers:{ "X-Auth-Token": process.env.API_KEY }
    });

    const data = await r.json();
    res.json(data);
  }catch{
    res.status(500).json({error:"API ERROR"});
  }
});

app.get("/",(req,res)=>res.send("API WORKING"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("SERVER RUNNING"));
