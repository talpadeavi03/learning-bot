// AETHER FRONTEND CONTROLLER

let activityChart = null;

async function loadData() {
  try {
    const state = await fetch("./data/state.json").then(r => r.json());
    const response = await fetch("./data/aether_response.json").then(r => r.json());
    const dashboard = await fetch("./data/dashboard.json").then(r => r.json());

    document.getElementById("status").innerText = response.message;

    document.getElementById("insights").innerHTML = `
      <p><b>Focus:</b> ${state.focus}</p>
      <p><b>Mode:</b> ${state.mode}</p>
      <p><b>Topic:</b> ${state.dominant_topic}</p>
      <p><b>Fatigue:</b> ${state.fatigue}</p>
    `;

    const activityDiv = document.getElementById("activity");
    activityDiv.innerHTML = "";

    dashboard.activity.forEach(a => {
      const el = document.createElement("p");
      el.innerText = `${a.topic}: ${a.minutes} minutes`;
      activityDiv.appendChild(el);
    });

    const labels = dashboard.activity.map(a => a.topic);
    const values = dashboard.activity.map(a => a.minutes);

    renderChart(labels, values);
    updateOrbState(state);

  } catch (err) {
    console.error("AETHER load error:", err);
  }
}


// CHART
function renderChart(labels, values) {
  const ctx = document.getElementById("activityChart");

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Minutes", data: values }]
    }
  });
}


// ORB INTELLIGENCE
function updateOrbState(state) {
  const orb = document.querySelector(".orb");

  if (state.mode === "deep_work") {
    orb.style.background = "radial-gradient(circle, #00ff88, #003322)";
    orb.style.animationDuration = "1.5s";
  } else if (state.fatigue > 0.7) {
    orb.style.background = "radial-gradient(circle, #ff0033, #330000)";
    orb.style.animationDuration = "4s";
  } else {
    orb.style.background = "radial-gradient(circle, #00f7ff, #001f2f)";
    orb.style.animationDuration = "2.5s";
  }
}


// 🔥 NEURAL BACKGROUND
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

window.addEventListener("resize", resizeCanvas);

// create particles
for (let i = 0; i < 80; i++) {
  particles.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 1,
    vy: (Math.random() - 0.5) * 1
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#00f7ff";
    ctx.fill();
  });

  requestAnimationFrame(draw);
}

draw();


// CHAT
function send() {
  const input = document.getElementById("input").value;
  const box = document.getElementById("chat-box");

  box.innerHTML += `<p><b>You:</b> ${input}</p>`;
  box.innerHTML += `<p><b>AETHER:</b> Processing...</p>`;
}


// INIT
loadData();