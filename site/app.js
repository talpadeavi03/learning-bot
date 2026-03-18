let activityChart=null;

window.onload=function(){
init();
};

function init(){

loadData();
initBackground();
startMonitor();
log("AETHER system initialized");

}

async function loadData(){

const state=await fetch("./data/state.json").then(r=>r.json());
const response=await fetch("./data/aether_response.json").then(r=>r.json());
const dashboard=await fetch("./data/dashboard.json").then(r=>r.json());

document.getElementById("status").innerText=response.message;

document.getElementById("insights").innerHTML=`
Focus: ${state.focus}<br>
Mode: ${state.mode}<br>
Topic: ${state.dominant_topic}<br>
Fatigue: ${state.fatigue}
`;

const activityDiv=document.getElementById("activity");
activityDiv.innerHTML="";

dashboard.activity.forEach(a=>{
const el=document.createElement("p");
el.innerText=`${a.topic}: ${a.minutes} minutes`;
activityDiv.appendChild(el);
});

const labels=dashboard.activity.map(a=>a.topic);
const values=dashboard.activity.map(a=>a.minutes);

renderChart(labels,values);

log("Behavior dataset loaded");

}

function renderChart(labels,values){

const ctx=document.getElementById("activityChart");

if(activityChart)activityChart.destroy();

activityChart=new Chart(ctx,{
type:"bar",
data:{
labels,
datasets:[{
label:"Minutes Spent",
data:values
}]
}
});

}

function send(){

const input=document.getElementById("input").value;
const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

respond(input);

}

function respond(text){

let reply="Analyzing behavioral patterns...";

if(text.includes("where")){
reply="I exist inside your behavioral intelligence system.";
}

if(text.includes("hello")||text.includes("hi")){
reply="Hello Avi. Your cognitive state looks stable.";
}

typing(reply);
speak(reply);

}

function typing(text){

const box=document.getElementById("chat-box");
const p=document.createElement("p");
box.appendChild(p);

let i=0;

function type(){
if(i<text.length){
p.innerHTML="<b>AETHER:</b> "+text.substring(0,i);
i++;
setTimeout(type,25);
}
}

type();

}

function speak(text){

const speech=new SpeechSynthesisUtterance(text);
speech.rate=1;
speech.pitch=1;
speech.lang="en-US";

speechSynthesis.speak(speech);

}

function log(msg){

const logs=document.getElementById("system-logs");

const line=document.createElement("div");
line.innerText="> "+msg;

logs.prepend(line);

}

function startMonitor(){

setInterval(()=>{

const cpu=(Math.random()*40+20).toFixed(1);
const mem=(Math.random()*30+40).toFixed(1);

document.getElementById("system-monitor").innerHTML=`
CPU: ${cpu}%<br>
Memory: ${mem}%<br>
AI Status: operational
`;

},2000);

}

/* neural background */

function initBackground(){

const canvas=document.getElementById("bg-canvas");
const ctx=canvas.getContext("2d");

canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

let particles=[];

for(let i=0;i<80;i++){

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
ctx.fillStyle="#00f7ff";
ctx.fill();

});

requestAnimationFrame(draw);

}

draw();

}