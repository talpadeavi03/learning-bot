/* CHAT TOGGLE */
function toggleChat(){
document.getElementById("chat-panel").classList.toggle("open");
}

/* DASHBOARD TOGGLE */
function toggleDashboard(){

const dash=document.getElementById("dashboard");

if(dash.style.display==="flex"){
dash.style.display="none";
}else{
dash.style.display="flex";
}

}

/* ENTER KEY */
document.addEventListener("DOMContentLoaded",()=>{

document.getElementById("input").addEventListener("keydown",(e)=>{
if(e.key==="Enter"){
send();
}
});

loadDashboard();

});

/* SEND MESSAGE */
async function send(){

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

/* 🔥 ML CONNECTION */
async function aiResponse(text){

try{

// 🔴 CHANGE THIS TO YOUR BACKEND
const res = await fetch("http://localhost:8000/predict", {
method:"POST",
headers:{"Content-Type":"application/json"},
body: JSON.stringify({query:text})
});

const data = await res.json();

typeText(data.reply || "No response");

}catch(e){

typeText("ML system not connected");

}

}

/* TYPE EFFECT */
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

/* DASHBOARD LOAD */
async function loadDashboard(){

try{

const data=await fetch("./data/dashboard.json").then(r=>r.json());

const activity=document.getElementById("activity");

data.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes}</p>`;
});

document.getElementById("insights").innerHTML=
"Focus: 0.82<br>Mode: deep_work";

}catch(e){
console.log("Dashboard error");
}

}