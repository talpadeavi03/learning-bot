let activityChart=null;

window.onload=function(){
bootSequence();
};

function bootSequence(){

const text=`AETHER OS v1.0
Initializing neural interface...
Loading cognitive models...
Connecting behavior database...
System ready...`;

let i=0;

const bootText=document.getElementById("boot-text");

function type(){
if(i<text.length){
bootText.innerHTML+=text.charAt(i);
i++;
setTimeout(type,30);
}else{
setTimeout(()=>{
document.getElementById("boot-screen").style.display="none";
init();
},1000);
}
}

type();
}

function init(){
loadData();
initBackground();
log("System initialized");
}

async function loadData(){

try{

const state=await fetch("./data/state.json").then(r=>r.json());
const response=await fetch("./data/aether_response.json").then(r=>r.json());
const dashboard=await fetch("./data/dashboard.json").then(r=>r.json());

document.getElementById("status").innerText=response.message;

document.getElementById("insights").innerHTML=`
<p>Focus: ${state.focus}</p>
<p>Mode: ${state.mode}</p>
<p>Topic: ${state.dominant_topic}</p>
<p>Fatigue: ${state.fatigue}</p>
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

updateOrb(state);

log("Behavior dataset loaded");

}catch(err){

log("ERROR loading AI state");

}

}

function renderChart(labels,values){

const ctx=document.getElementById("activityChart");

if(activityChart)activityChart.destroy();

activityChart=new Chart(ctx,{
type:"bar",
data:{
labels,
datasets:[{label:"Minutes",data:values}]
}
});

}

function updateOrb(state){

const orb=document.querySelector(".orb");

if(state.mode==="deep_work"){
orb.style.background="radial-gradient(circle,#00ff88,#003322)";
}else if(state.fatigue>0.7){
orb.style.background="radial-gradient(circle,#ff0033,#330000)";
}else{
orb.style.background="radial-gradient(circle,#00f7ff,#001f2f)";
}

}

function log(message){

const logs=document.getElementById("system-logs");

const line=document.createElement("div");

line.innerText="> "+message;

logs.prepend(line);

}

function send(){

const input=document.getElementById("input").value;

const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

typingEffect("Analyzing behavioral data...");

}

function typingEffect(text){

const box=document.getElementById("chat-box");

const p=document.createElement("p");

box.appendChild(p);

let i=0;

function type(){

if(i<text.length){

p.innerHTML="<b>AETHER:</b> "+text.substring(0,i);

i++;

setTimeout(type,30);

}

}

type();

}

function initBackground(){

const canvas=document.getElementById("bg-canvas");

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
ctx.fillStyle="#00f7ff";
ctx.fill();

});

requestAnimationFrame(draw);

}

draw();

}