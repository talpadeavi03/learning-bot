export default {
  async fetch(request) {

    if (request.method !== "POST") {
      return new Response("AETHER API running");
    }

    const body = await request.json();
    const text = body.query.toLowerCase();

    let reply = "Analyzing behavior data...";

    if (text.includes("study")) {
      reply = "You studied Kubernetes the most today.";
    }

    if (text.includes("productivity")) {
      reply = "Your peak productivity window is around 10AM–2PM.";
    }

    return new Response(JSON.stringify({ reply }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}