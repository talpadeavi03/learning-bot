let chart

function toggleChat(){
document.getElementById("chatPanel").classList.toggle("hidden")
}

async function loadDashboard(){

const data=await fetch("./data/dashboard.json").then(r=>r.json())

/* metrics */

document.getElementById("focusBar").style.width=data.metrics.focus+"%"
document.getElementById("learningBar").style.width=data.metrics.learning+"%"
document.getElementById("productivityBar").style.width=data.metrics.productivity+"%"

/* activity */

const activity=document.getElementById("activity")

data.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes} min</p>`
})

/* timeline */

const timeline=document.getElementById("timeline")

data.timeline.forEach(t=>{
timeline.innerHTML+=`<li>${t.time} — ${t.event}</li>`
})

/* chart */

const ctx=document.getElementById("activityChart")

chart=new Chart(ctx,{
type:"doughnut",
data:{
labels:data.activity.map(a=>a.topic),
datasets:[{
data:data.activity.map(a=>a.minutes),
backgroundColor:[
"#00ffff",
"#00ffaa",
"#ffaa00",
"#ff0077"
]
}]
}
})

}

loadDashboard()

async function sendChat(){

const input=document.getElementById("chatInput").value
if(!input) return

const box=document.getElementById("chatMessages")

box.innerHTML+=`<div>You: ${input}</div>`

document.getElementById("chatInput").value=""

document.getElementById("thinking").classList.remove("hidden")

try{

const res=await fetch("https://aether-api.YOURNAME.workers.dev",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({query:input})
})

const data=await res.json()

document.getElementById("thinking").classList.add("hidden")

typeText(data.reply)

}catch{

document.getElementById("thinking").classList.add("hidden")

box.innerHTML+=`<div>AETHER: backend unavailable</div>`

}

}

function typeText(text){

const box=document.getElementById("chatMessages")
const el=document.createElement("div")

box.appendChild(el)

let i=0

function type(){
if(i<text.length){
el.innerHTML="AETHER: "+text.substring(0,i)
i++
setTimeout(type,20)
}
}

type()

}