function toggleChat(){

const panel=document.getElementById("chat-panel");

if(panel.style.display==="none"){
panel.style.display="block";
}else{
panel.style.display="none";
}

}

function send(){

const input=document.getElementById("input").value;

const box=document.getElementById("chat-box");

box.innerHTML += "<p>You: "+input+"</p>";

}