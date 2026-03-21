export default {
  async fetch(request, env) {

    const url = new URL(request.url)

    // API route
    if (url.pathname.startsWith("/api")) {
      return new Response(
        JSON.stringify({
          status: "AETHER API ONLINE",
          version: "2.0"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      )
    }

    // Serve frontend
    return env.ASSETS.fetch(request)

  }
}