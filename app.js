const $ = (id) => document.getElementById(id);
const points = $("points");
const msg = $("msg");
const panel = $("panel");

let user = JSON.parse(localStorage.getItem("followboost_user") || "null");
if (user) points.textContent = user.points ?? 0;

function deviceId() {
  let id = localStorage.getItem("followboost_device_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();
    localStorage.setItem("followboost_device_id", id);
  }
  return id;
}

$("signup").onclick = async () => {
  msg.textContent = "Creating account...";
  const body = {
    name: $("name").value,
    email: $("email").value,
    password: $("password").value,
    deviceId: deviceId()
  };
  const r = await fetch("/api/signup", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
  const data = await r.json();
  if (!r.ok) return msg.textContent = data.error || "Signup failed.";
  user = data.user;
  localStorage.setItem("followboost_user", JSON.stringify(user));
  points.textContent = user.points;
  msg.textContent = "Account created successfully.";
};

$("checkin").onclick = () => {
  const last = localStorage.getItem("followboost_checkin");
  const today = new Date().toISOString().slice(0,10);
  if (last === today) return msg.textContent = "You already checked in today.";
  localStorage.setItem("followboost_checkin", today);
  if (user) {
    user.points = Number(user.points || 0) + 10;
    localStorage.setItem("followboost_user", JSON.stringify(user));
    points.textContent = user.points;
  }
  msg.textContent = "+10 points added for today's check-in.";
};

window.show = (name) => {
  panel.classList.remove("hidden");
  const text = {
    Tasks: "Complete available social tasks to earn points.",
    Wallet: "Your points and transaction history will appear here.",
    Referrals: "Invite friends with your referral link and earn referral rewards.",
    "Buy Points": "Point packages can be connected to a payment provider in the next version."
  }[name];
  panel.innerHTML = `<h2>${name}</h2><p>${text}</p>`;
};