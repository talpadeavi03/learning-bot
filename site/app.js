// AETHER FRONTEND CONTROLLER

let activityChart = null;

async function loadData() {
  try {

    const state = await fetch("./data/state.json").then(r => r.json());
    const response = await fetch("./data/aether_response.json").then(r => r.json());
    const dashboard = await fetch("./data/dashboard.json").then(r => r.json());

    // Update AETHER status message
    document.getElementById("status").innerText = response.message;

    // Update insights panel
    document.getElementById("insights").innerHTML = `
      <p><b>Focus:</b> ${state.focus}</p>
      <p><b>Mode:</b> ${state.mode}</p>
      <p><b>Topic:</b> ${state.dominant_topic}</p>
      <p><b>Fatigue:</b> ${state.fatigue}</p>
    `;

    // Activity list
    const activityDiv = document.getElementById("activity");
    activityDiv.innerHTML = "";

    dashboard.activity.forEach(a => {
      const el = document.createElement("p");
      el.innerText = `${a.topic}: ${a.minutes} minutes`;
      activityDiv.appendChild(el);
    });

    // Chart data
    const labels = dashboard.activity.map(a => a.topic);
    const values = dashboard.activity.map(a => a.minutes);

    renderChart(labels, values);

    // Orb reaction based on AI state
    const orb = document.querySelector(".orb");

    if (state.mode === "deep_work") {
      orb.style.background = "radial-gradient(circle, #00ff88, #003322)";
      orb.style.boxShadow = "0 0 30px #00ff88";
    } 
    else if (state.fatigue > 0.7) {
      orb.style.background = "radial-gradient(circle, #ff0033, #330000)";
      orb.style.boxShadow = "0 0 30px #ff0033";
    } 
    else {
      orb.style.background = "radial-gradient(circle, #00f7ff, #001f2f)";
      orb.style.boxShadow = "0 0 30px #00f7ff";
    }

  } catch (err) {

    console.error("AETHER load error:", err);
    document.getElementById("status").innerText = "Error loading AI state.";

  }
}


function renderChart(labels, values) {

  const ctx = document.getElementById("activityChart");

  if (activityChart) {
    activityChart.destroy();
  }

  activityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Minutes Spent",
        data: values
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#00f7ff" }
        }
      },
      scales: {
        x: { ticks: { color: "#00f7ff" } },
        y: { ticks: { color: "#00f7ff" } }
      }
    }
  });

}


// CHAT SYSTEM
function send() {

  const inputField = document.getElementById("input");
  const input = inputField.value.trim();
  const box = document.getElementById("chat-box");

  if (!input) return;

  box.innerHTML += `<p><b>You:</b> ${input}</p>`;
  inputField.value = "";

  const thinking = document.createElement("p");
  thinking.innerHTML = "<b>AETHER:</b> ...";
  box.appendChild(thinking);

  setTimeout(() => {

    let reply = "Analyzing behavioral data...";

    if (input.toLowerCase().includes("study")) {
      reply = "Learning efficiency increases during deep work cycles.";
    } 
    else if (input.toLowerCase().includes("productivity")) {
      reply = "Peak productivity window detected between 10AM-2PM.";
    } 
    else if (input.toLowerCase().includes("exercise")) {
      reply = "Exercise correlates with improved cognitive stability.";
    }

    thinking.innerHTML = `<b>AETHER:</b> ${reply}`;

    box.scrollTop = box.scrollHeight;

  }, 1000);

}


// INITIAL LOAD
loadData();