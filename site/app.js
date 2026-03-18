function launchAI(){

document.querySelector(".hero").style.display="none";
document.getElementById("chat-section").style.display="block";
document.getElementById("dashboard").style.display="block";

loadDashboard();

}

/* CHAT */

function send(){

const input=document.getElementById("input").value;

const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

respond(input);

}

function respond(text){

let reply="Analyzing behavioral data.";

if(text.includes("hello")||text.includes("hi")){
reply="Hello Avi. System operational.";
}

box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>AETHER:</b> ${reply}</p>`;

}

/* DASHBOARD */

async function loadDashboard(){

const dashboard=await fetch("./data/dashboard.json").then(r=>r.json());

const activity=document.getElementById("activity");

dashboard.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes} minutes</p>`;
});

/* chart */

const ctx=document.getElementById("activityChart");

new Chart(ctx,{
type:"bar",
data:{
labels:dashboard.activity.map(a=>a.topic),
datasets:[{
label:"Minutes",
data:dashboard.activity.map(a=>a.minutes)
}]
}
});

/* insights */

document.getElementById("insights").innerHTML=`
Focus: 0.82<br>
Mode: deep_work<br>
Topic: kubernetes
`;

}