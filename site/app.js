async function loadData() {
  const state = await fetch("data/state.json").then(r => r.json());
  const response = await fetch("data/aether_response.json").then(r => r.json());

  document.getElementById("status").innerText = response.message;

  document.getElementById("insights").innerHTML = `
    <p>Focus: ${state.focus}</p>
    <p>Mode: ${state.mode}</p>
    <p>Topic: ${state.dominant_topic}</p>
  `;
}

function send() {
  const input = document.getElementById("input").value;
  const box = document.getElementById("chat-box");

  box.innerHTML += `<p><b>You:</b> ${input}</p>`;

  // fake AI response (replace later)
  box.innerHTML += `<p><b>AETHER:</b> Processing request...</p>`;
}

loadData();