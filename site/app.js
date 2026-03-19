function toggleChat(){
document.getElementById("chat-panel").classList.toggle("open");
}

function showPage(page){

const p=document.getElementById("page");

if(page==="dashboard"){
p.innerHTML="<h2>Dashboard</h2>";
}

if(page==="activity"){
p.innerHTML="<h2>Activity Stream</h2>";
}

if(page==="analytics"){
p.innerHTML="<h2>Analytics</h2>";
}

}

/* CHAT */

function send(){

const input=document.getElementById("input").value;

if(!input) return;

const box=document.getElementById("chat-box");

box.innerHTML+=`<p>You: ${input}</p>`;

document.getElementById("input").value="";

}