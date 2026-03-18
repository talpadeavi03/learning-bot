let chart;

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

aiThinking(input);

}

/* thinking */

function aiThinking(text){

const thinking=document.getElementById("thinking");

thinking.style.display="block";

setTimeout(()=>{
thinking.style.display="none";
aiResponse(text);
},900);

}

/* response */

function aiResponse(text){

let reply="Analyzing behavioral data.";

if(text.includes("hello")||text.includes("hi")){
reply="Hello Avi. System operational.";
}

typeText(reply);

}

/* typing */

function typeText(text){

const box=document.getElementById("chat-box");

const p=document.createElement("p");

box.appendChild(p);

let i=0;

function type(){

if(i<text.length){

p.innerHTML="<b>AETHER:</b> "+text.substring(0,i);

i++;

setTimeout(type,20);

}

}

type();

}

/* dashboard */

async function loadDashboard(){

const data=await fetch("./data/dashboard.json").then(r=>r.json());

const ctx=document.getElementById("activityChart");

chart=new Chart(ctx,{
type:"bar",
data:{
labels:data.activity.map(a=>a.topic),
datasets:[{
label:"Minutes",
data:data.activity.map(a=>a.minutes)
}]
},
options:{
animation:{duration:1500}
}
});

const activity=document.getElementById("activity");

data.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes} minutes</p>`;
});

document.getElementById("insights").innerHTML=
`Focus: 0.82<br>Mode: deep_work<br>Topic: kubernetes`;

}

/* particle background */

function initParticles(){

const canvas=document.getElementById("bg");
const ctx=canvas.getContext("2d");

canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

let particles=[];

for(let i=0;i<60;i++){

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