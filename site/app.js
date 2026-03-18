/* TOGGLE CHAT */
function toggleChat(){

const panel=document.getElementById("chat-panel");

panel.classList.toggle("open");

}

/* ENTER KEY SUPPORT */
document.addEventListener("DOMContentLoaded",()=>{

document.getElementById("input").addEventListener("keydown",(e)=>{
if(e.key==="Enter"){
send();
}
});

initParticles();

});

/* SEND MESSAGE */
function send(){

const input=document.getElementById("input").value.trim();

if(!input) return;

const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

document.getElementById("input").value="";

aiThinking(input);

}

/* THINKING */
function aiThinking(text){

const thinking=document.getElementById("thinking");

thinking.style.display="block";

setTimeout(()=>{
thinking.style.display="none";
aiResponse(text);
},800);

}

/* RESPONSE */
function aiResponse(text){

let reply="Analyzing your behavior patterns...";

if(text.includes("hi")||text.includes("hello")){
reply="Hello Avi. Everything looks stable.";
}

if(text.includes("work")){
reply="You perform best during deep focus sessions.";
}

typeText(reply);

}

/* TYPING EFFECT */
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

/* BACKGROUND PARTICLES */
function initParticles(){

const canvas=document.getElementById("bg");
const ctx=canvas.getContext("2d");

canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

let particles=[];

for(let i=0;i<40;i++){

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