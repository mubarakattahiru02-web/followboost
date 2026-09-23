import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

dotenv.config();
const {Pool}=pg;
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL});
app.use(cors()); app.use(express.json());

const token=u=>jwt.sign({id:u.id,role:u.role},process.env.JWT_SECRET,{expiresIn:"7d"});
function auth(req,res,next){
  try{req.user=jwt.verify((req.headers.authorization||"").replace("Bearer ",""),process.env.JWT_SECRET);next();}
  catch{res.status(401).json({error:"Unauthorized"});}
}

app.get("/api/health",(_,res)=>res.json({ok:true,app:"FollowBoost"}));

app.post("/api/auth/register",async(req,res)=>{
  const {email,password,country=null,currency="USD",deviceId=null}=req.body;
  if(!email||!password)return res.status(400).json({error:"Email and password are required"});
  const old=await pool.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1)",[email]);
  if(old.rowCount)return res.status(409).json({error:"Email already registered"});
  if(deviceId){
    const d=await pool.query("SELECT user_id FROM device_links WHERE device_hash=$1 AND blocked=false LIMIT 1",[deviceId]);
    if(d.rowCount)return res.status(409).json({error:"This device is already linked to an account"});
  }
  const hash=await bcrypt.hash(password,12);
  const r=await pool.query(
    "INSERT INTO users(email,password_hash,country,currency,role) VALUES($1,$2,$3,$4,'user') RETURNING id,email,country,currency,role",
    [email,hash,country,currency]);
  const u=r.rows[0];
  await pool.query("INSERT INTO point_wallets(user_id,balance) VALUES($1,0)",[u.id]);
  if(deviceId)await pool.query("INSERT INTO device_links(device_hash,user_id) VALUES($1,$2)",[deviceId,u.id]);
  res.status(201).json({user:u,token:token(u)});
});

app.post("/api/auth/login",async(req,res)=>{
  const r=await pool.query("SELECT id,email,password_hash,country,currency,role,status FROM users WHERE LOWER(email)=LOWER($1)",[req.body.email]);
  if(!r.rowCount)return res.status(401).json({error:"Invalid login details"});
  const u=r.rows[0];
  if(u.status!=="active")return res.status(403).json({error:"Account is not active"});
  if(!(await bcrypt.compare(req.body.password,u.password_hash)))return res.status(401).json({error:"Invalid login details"});
  delete u.password_hash; res.json({user:u,token:token(u)});
});

app.get("/api/me",auth,async(req,res)=>{
  const r=await pool.query("SELECT u.id,u.email,u.country,u.currency,u.role,u.status,w.balance FROM users u JOIN point_wallets w ON w.user_id=u.id WHERE u.id=$1",[req.user.id]);
  res.json(r.rows[0]||null);
});

app.get("/api/wallet",auth,async(req,res)=>{
  const w=await pool.query("SELECT balance FROM point_wallets WHERE user_id=$1",[req.user.id]);
  const l=await pool.query("SELECT type,amount,reference,created_at FROM point_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[req.user.id]);
  res.json({balance:w.rows[0]?.balance||0,transactions:l.rows});
});

app.post("/api/checkin",auth,async(req,res)=>{
  const day=new Date().toISOString().slice(0,10);
  const x=await pool.query("SELECT id FROM daily_checkins WHERE user_id=$1 AND checkin_date=$2",[req.user.id,day]);
  if(x.rowCount)return res.status(409).json({error:"Already checked in today"});
  const prev=await pool.query("SELECT checkin_date,streak FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 1",[req.user.id]);
  let streak=1;
  if(prev.rowCount){
    const diff=Math.round((new Date(day)-new Date(prev.rows[0].checkin_date))/86400000);
    if(diff===1)streak=Math.min(prev.rows[0].streak+1,7);
  }
  const rewards=[10,15,20,25,30,40,50], reward=rewards[streak-1];
  await pool.query("BEGIN");
  try{
    await pool.query("INSERT INTO daily_checkins(user_id,checkin_date,streak,reward) VALUES($1,$2,$3,$4)",[req.user.id,day,streak,reward]);
    await pool.query("UPDATE point_wallets SET balance=balance+$1 WHERE user_id=$2",[reward,req.user.id]);
    await pool.query("INSERT INTO point_ledger(user_id,type,amount,reference) VALUES($1,'daily_checkin',$2,$3)",[req.user.id,reward,"checkin:"+day]);
    await pool.query("COMMIT"); res.json({streak,reward});
  }catch(e){await pool.query("ROLLBACK");res.status(500).json({error:"Check-in failed"});}
});

app.get("/api/packages",async(_,res)=>{
  const r=await pool.query("SELECT id,name,points,price,currency FROM point_packages WHERE active=true ORDER BY points");res.json(r.rows);
});

app.post("/api/payments/create",auth,async(req,res)=>{
  const r=await pool.query("SELECT id,name,points,price,currency FROM point_packages WHERE id=$1 AND active=true",[req.body.packageId]);
  if(!r.rowCount)return res.status(404).json({error:"Package not found"});
  const p=r.rows[0];
  const q=await pool.query(
    "INSERT INTO payments(user_id,package_id,provider,amount,currency,status) VALUES($1,$2,'pending_provider',$3,$4,'pending') RETURNING id,status",
    [req.user.id,p.id,p.price,req.body.currency||p.currency]);
  res.status(201).json({payment:q.rows[0],message:"Connect this order to the configured payment provider. Credit points only after verified webhook."});
});

app.get("/api/admin/stats",auth,async(req,res)=>{
  if(req.user.role!=="admin")return res.status(403).json({error:"Admin only"});
  const [u,p,pts]=await Promise.all([
    pool.query("SELECT COUNT(*)::int total FROM users"),
    pool.query("SELECT COUNT(*)::int total FROM payments WHERE status='paid'"),
    pool.query("SELECT COALESCE(SUM(amount),0)::int total FROM point_ledger WHERE amount>0")
  ]);
  res.json({totalUsers:u.rows[0].total,paidPayments:p.rows[0].total,pointsIssued:pts.rows[0].total});
});

app.listen(process.env.PORT||4000,()=>console.log("FollowBoost API running"));
