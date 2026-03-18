let scene, camera, renderer, brain, rings=[];
let mouseX=0, mouseY=0;
let activityChart=null;

init();
animate();

/* INIT */
function init(){

init3D();
loadData();
animateUI();

}

/* 3D SYSTEM */
function init3D(){

scene=new THREE.Scene();

camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.z=4;

renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
document.getElementById("three-container").appendChild(renderer.domElement);

/* LIGHT */
const light=new THREE.PointLight(0x00eaff,1);
light.position.set(5,5,5);
scene.add(light);

/* BRAIN */
const geometry=new THREE.SphereGeometry(1.2,64,64);
const material=new THREE.MeshBasicMaterial({
wireframe:true,
color:0x00eaff,
transparent:true,
opacity:0.6
});

brain=new THREE.Mesh(geometry,material);
scene.add(brain);

/* RINGS */
for(let i=0;i<3;i++){
const geo=new THREE.TorusGeometry(2+i*0.3,0.03,16,100);
const mat=new THREE.MeshBasicMaterial({color:0x00ffff});
const ring=new THREE.Mesh(geo,mat);
scene.add(ring);
rings.push(ring);
}

/* MOUSE */
document.addEventListener("mousemove",(e)=>{
mouseX=(e.clientX/window.innerWidth-0.5)*2;
mouseY=(e.clientY/window.innerHeight-0.5)*2;
});

}

/* ANIMATION */
function animate(){

requestAnimationFrame(animate);

brain.rotation.y+=0.01 + mouseX*0.02;
brain.rotation.x+=0.005 + mouseY*0.02;

rings.forEach((r,i)=>{
r.rotation.z+=0.01+(i*0.01);
});

brain.position.y=Math.sin(Date.now()*0.002)*0.1;

renderer.render(scene,camera);

}

/* UI ANIMATION */
function animateUI(){

const panels=document.querySelectorAll(".panel");

panels.forEach((p,i)=>{

p.style.opacity=0;
p.style.transform="translateY(40px) scale(0.95)";

setTimeout(()=>{
p.style.transition="all 0.8s cubic-bezier(0.22,1,0.36,1)";
p.style.opacity=1;
p.style.transform="translateY(0) scale(1)";
},i*150);

});

}

/* DATA */
async function loadData(){

const dashboard=await fetch("./data/dashboard.json").then(r=>r.json());

const activityDiv=document.getElementById("activity");

dashboard.activity.forEach(a=>{
activityDiv.innerHTML+=`<p>${a.topic}: ${a.minutes}</p>`;
});

}

/* CHAT */
function send(){

const input=document.getElementById("input").value;
const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

respond(input);

}

/* RESPONSE */
function respond(text){

let reply="Analyzing neural data...";

if(text.includes("hi")||text.includes("hello")){
reply="Hello Avi. System fully operational.";
}

typing(reply);
speak(reply);

}

/* typing */
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

/* voice */
function speak(text){
const speech=new SpeechSynthesisUtterance(text);
speechSynthesis.speak(speech);
}

function voiceCommand(){

const recognition=new webkitSpeechRecognition();
recognition.start();

recognition.onresult=function(e){
const text=e.results[0][0].transcript;
document.getElementById("input").value=text;
send();
};

}