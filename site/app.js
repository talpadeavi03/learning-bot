let chart

function toggleChat(){
const panel=document.getElementById("chatPanel")
panel.classList.toggle("hidden")
}

/* DASHBOARD DATA */

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
data:data.activity.map(a=>a.minutes),
backgroundColor:"#00ffcc"
}]
}
})

}

loadDashboard()

/* CHAT */

async function sendChat(){

const input=document.getElementById("chatInput").value
if(!input) return

const box=document.getElementById("chatMessages")

box.innerHTML+=`<div>You: ${input}</div>`

document.getElementById("chatInput").value=""

try{

const res=await fetch("https://aether-api.YOURNAME.workers.dev",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({query:input})
})

const data=await res.json()

typeText(data.reply)

}catch{

box.innerHTML+=`<div>AETHER: backend unavailable</div>`

}

box.scrollTop=box.scrollHeight

}

/* TYPING EFFECT */

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

/* VOICE INPUT */

function startVoice(){

const recognition=new webkitSpeechRecognition()

recognition.onresult=function(e){

const text=e.results[0][0].transcript

document.getElementById("chatInput").value=text

sendChat()

}

recognition.start()

}

/* THREE JS NEURAL SPHERE */

const scene=new THREE.Scene()

const camera=new THREE.PerspectiveCamera(75,1,0.1,1000)

const renderer=new THREE.WebGLRenderer()

renderer.setSize(300,300)

document.getElementById("neuralCanvas").appendChild(renderer.domElement)

const geometry=new THREE.SphereGeometry(2,32,32)

const material=new THREE.MeshBasicMaterial({
wireframe:true,
color:0x00ffcc
})

const sphere=new THREE.Mesh(geometry,material)

scene.add(sphere)

camera.position.z=5

function animate(){

requestAnimationFrame(animate)

sphere.rotation.x+=0.003
sphere.rotation.y+=0.004

renderer.render(scene,camera)

}

animate()