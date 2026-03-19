let chart

function toggleSidebar(){
const sidebar=document.getElementById("sidebar")
sidebar.classList.toggle("-translate-x-full")
}

function toggleChat(){
const panel=document.getElementById("chatPanel")
panel.classList.toggle("hidden")
}

function showPage(page){

const p=document.getElementById("page")

if(page==="dashboard"){
location.reload()
}

if(page==="activity"){
p.innerHTML="<h1 class='text-xl'>Activity Stream</h1>"
}

if(page==="analytics"){
p.innerHTML="<h1 class='text-xl'>Analytics Coming Soon</h1>"
}

}

async function loadDashboard(){

const data=await fetch("./data/dashboard.json").then(r=>r.json())

const activity=document.getElementById("activity")

data.activity.forEach(a=>{
activity.innerHTML+=`<p>${a.topic}: ${a.minutes} minutes</p>`
})

const ctx=document.getElementById("activityChart")

chart=new Chart(ctx,{
type:"bar",
data:{
labels:data.activity.map(a=>a.topic),
datasets:[{
label:"Minutes",
data:data.activity.map(a=>a.minutes)
}]
}
})

}

loadDashboard()

async function sendChat(){

const input=document.getElementById("chatInput").value
if(!input) return

const box=document.getElementById("chatMessages")

box.innerHTML+=`<div class="mb-2">You: ${input}</div>`

document.getElementById("chatInput").value=""

try{

const res=await fetch("https://learning-bot.talpadeavi0303.workers.dev/",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({query:input})
})

const data=await res.json()

box.innerHTML+=`<div class="mb-2 text-green-300">AETHER: ${data.reply}</div>`

}catch{

box.innerHTML+=`<div>AETHER: backend unavailable</div>`

}

box.scrollTop=box.scrollHeight

}