import json
import requests
import os

WORKER_URL = os.getenv(
    "WORKER_URL",
    "https://learning-bot.talpadeavi0303.workers.dev"
)

GRAPH_FILE = "data/code_graph.json"


def main():

    if not os.path.exists(GRAPH_FILE):
        print("[AETHER] code_graph.json not found")
        return

    with open(GRAPH_FILE, "r") as f:
        graph = json.load(f)

    print("[AETHER] Loaded graph")

    res = requests.post(
        f"{WORKER_URL}/update-code-graph",
        json=graph,
        timeout=60
    )

    print("[AETHER] Worker response:", res.status_code)

    if res.status_code != 200:
        print(res.text)
    else:
        print("[AETHER] Graph successfully pushed to Worker KV")


if __name__ == "__main__":
    main()