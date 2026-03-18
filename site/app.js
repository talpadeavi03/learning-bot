/* launch */

function launchAI(){

document.getElementById("hero").style.display="none";

document.getElementById("chat-section").style.display="block";
document.getElementById("dashboard").style.display="block";

initParticles();
loadDashboard();

}

/* chat */

function send(){

const input=document.getElementById("input").value;

const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

setTimeout(()=>{
box.innerHTML+=`<p><b>AETHER:</b> Processing your request...</p>`;
},500);

}

/* dashboard */

async function loadDashboard(){

try{

const data=await fetch("./data/dashboard.json").then(r=>r.json());

const ctx=document.getElementById("activityChart");

new Chart(ctx,{
type:"bar",
data:{
labels:data.activity.map(a=>a.topic),
datasets:[{
label:"Minutes",
data:data.activity.map(a=>a.minutes)
}]
}
});

const activity=document.getElementById("activity");

data.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes} minutes</p>`;
});

document.getElementById("insights").innerHTML=
"Focus: 0.82<br>Mode: deep_work";

}catch(e){

console.log("Dashboard error:",e);

}

}

/* particles */

function initParticles(){

const canvas=document.getElementById("bg");
const ctx=canvas.getContext("2d");

canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

let particles=[];

for(let i=0;i<50;i++){

particles.push({
x:Math.random()*canvas.width,
y:Math.random()*canvas.height,
vx:(Math.random()-0.5),
vy:(Math.random()-0.5)
});

}

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

particles.forEach(p=>{
p.x+=p.vx;
p.y+=p.vy;

ctx.beginPath();
ctx.arc(p.x,p.y,2,0,Math.PI*2);
ctx.fillStyle="#00eaff";
ctx.fill();
});

requestAnimationFrame(draw);

}

draw();

}