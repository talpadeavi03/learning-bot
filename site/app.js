let scene, camera, renderer, brain, ring;

init3D();
animate();

function init3D(){

scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 5;

renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);

document.getElementById("three-container").appendChild(renderer.domElement);

/* LIGHT */
const light = new THREE.PointLight(0x00f7ff, 1);
light.position.set(10,10,10);
scene.add(light);

/* NEURAL BRAIN (sphere points) */
const geometry = new THREE.SphereGeometry(1,32,32);
const material = new THREE.MeshBasicMaterial({
wireframe:true,
color:0x00f7ff
});

brain = new THREE.Mesh(geometry, material);
scene.add(brain);

/* DATA RING */
const ringGeo = new THREE.TorusGeometry(2,0.05,16,100);
const ringMat = new THREE.MeshBasicMaterial({color:0x00ffcc});
ring = new THREE.Mesh(ringGeo, ringMat);

scene.add(ring);

}

/* ANIMATION LOOP */
function animate(){

requestAnimationFrame(animate);

brain.rotation.x += 0.01;
brain.rotation.y += 0.01;

ring.rotation.z += 0.02;

renderer.render(scene, camera);

}

/* CHAT */

function send(){

const input=document.getElementById("input").value;
const box=document.getElementById("chat-box");

box.innerHTML+=`<p><b>You:</b> ${input}</p>`;

respond(input);

}

/* AI RESPONSE */

function respond(text){

let reply="Processing neural data...";

if(text.includes("hello")||text.includes("hi")){
reply="Hello Avi. Neural system is active.";
}

typing(reply);
speak(reply);

}

/* typing effect */
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

/* voice output */
function speak(text){

const speech=new SpeechSynthesisUtterance(text);
speechSynthesis.speak(speech);

}

/* voice input */
function voiceCommand(){

const recognition=new webkitSpeechRecognition();
recognition.start();

recognition.onresult=function(e){

const text=e.results[0][0].transcript;
document.getElementById("input").value=text;
send();

};

}