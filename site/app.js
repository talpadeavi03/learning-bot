let scene, camera, renderer, brain, rings=[];
let mouseX=0, mouseY=0;

init();
animate();

function init(){

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
color:0x00eaff
});
brain=new THREE.Mesh(geometry,material);
scene.add(brain);

/* MULTIPLE RINGS */
for(let i=0;i<3;i++){
const geo=new THREE.TorusGeometry(2+i*0.3,0.03,16,100);
const mat=new THREE.MeshBasicMaterial({color:0x00ffff});
const ring=new THREE.Mesh(geo,mat);
ring.rotation.x=Math.random()*Math.PI;
scene.add(ring);
rings.push(ring);
}

/* NEURAL PARTICLES */
const particlesGeo=new THREE.BufferGeometry();
const particlesCount=300;

const posArray=new Float32Array(particlesCount*3);

for(let i=0;i<particlesCount*3;i++){
posArray[i]=(Math.random()-0.5)*5;
}

particlesGeo.setAttribute('position',new THREE.BufferAttribute(posArray,3));

const particlesMat=new THREE.PointsMaterial({
size:0.02,
color:0x00eaff
});

const particles=new THREE.Points(particlesGeo,particlesMat);
scene.add(particles);

/* MOUSE INTERACTION */
document.addEventListener("mousemove",(e)=>{
mouseX=(e.clientX/window.innerWidth-0.5)*2;
mouseY=(e.clientY/window.innerHeight-0.5)*2;
});

}

/* ANIMATION */
function animate(){

requestAnimationFrame(animate);

/* brain follow mouse */
brain.rotation.y+=0.01 + mouseX*0.02;
brain.rotation.x+=0.005 + mouseY*0.02;

/* rings rotate */
rings.forEach((r,i)=>{
r.rotation.z+=0.01+(i*0.01);
});

/* floating effect */
brain.position.y=Math.sin(Date.now()*0.002)*0.1;

renderer.render(scene,camera);

}