let activityChart=null;

window.onload=function(){
init();
};

function init(){

loadData();
initBackground();
initNeural();
startMonitor();
log("AETHER initialized");

}

/* LOAD DATA */

async function loadData(){

const state=await fetch("./data/state.json").then(r=>r.json());
const response=await fetch("./data/aether_response.json").then(r=>r.json());
const dashboard=await fetch("./data/dashboard.json").then(r=>r.json());

document.getElementById("status").innerText=response.message;

document.getElementById("insights").innerHTML=`
Focus: ${state.focus}<br>
Mode: ${state.mode}<br>
Topic: ${state.dominant_topic}
`;

const activityDiv=document.getElementById("activity");
activityDiv.innerHTML="";

dashboard.activity.forEach(a=>{
activityDiv.innerHTML+=`<p>${a.topic}: ${a.minutes} minutes</p>`;
});

const labels=dashboard.activity.map(a=>a.topic);
const values=dashboard.activity.map(a=>a.minutes);

renderChart(labels,values);

}

/* CHART */

function renderChart(labels,values){

const ctx=document.getElementById("activityChart");

if(activityChart)activityChart.destroy();

activityChart=new Chart(ctx,{
type:"bar",
data:{
labels,
datasets:[{
label:"Minutes",
data:values
}]
}
});

}

/* CHAT */

function send(){

const input=document.getElementById("input").value;
const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

respond(input);

}

function respond(text){

let reply="Analyzing behavioral patterns.";

if(text.includes("hello")||text.includes("hi")){
reply="Hello Avi. Your system looks stable.";
}

if(text.includes("where")){
reply="I exist inside your behavioral AI system.";
}

typing(reply);
speak(reply);
memory(text);

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
setTimeout(type,20);
}
}

type();

}

/* VOICE OUTPUT */

function speak(text){

const speech=new SpeechSynthesisUtterance(text);
speech.rate=1;
speech.pitch=1;
speech.lang="en-US";

speechSynthesis.speak(speech);

}

/* VOICE INPUT */

function voiceCommand(){

const recognition=new webkitSpeechRecognition();
recognition.start();

recognition.onresult=function(e){

const text=e.results[0][0].transcript;

document.getElementById("input").value=text;

send();

};

}

/* MEMORY TIMELINE */

function memory(text){

const mem=document.getElementById("memory");

const entry=document.createElement("div");

entry.innerText="Interaction: "+text;

mem.prepend(entry);

}

/* MONITOR */

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

/* LOGS */

function log(msg){

const logs=document.getElementById("system-logs");

logs.innerHTML=`> ${msg}<br>`+logs.innerHTML;

}

/* NEURAL VISUALIZER */

function initNeural(){

const canvas=document.getElementById("neural-canvas");
const ctx=canvas.getContext("2d");

canvas.width=window.innerWidth;
canvas.height=200;

let nodes=[];

for(let i=0;i<20;i++){

nodes.push({
x:Math.random()*canvas.width,
y:Math.random()*200,
vx:(Math.random()-0.5),
vy:(Math.random()-0.5)
});

}

function draw(){

ctx.clearRect(0,0,canvas.width,200);

nodes.forEach(n=>{

n.x+=n.vx;
n.y+=n.vy;

ctx.beginPath();
ctx.arc(n.x,n.y,3,0,Math.PI*2);
ctx.fillStyle="#00f7ff";
ctx.fill();

});

requestAnimationFrame(draw);

}

draw();

}