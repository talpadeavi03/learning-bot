import pandas as pd
import json
import os
from collections import defaultdict

INPUT = "data/processed/events_clean.csv"
OUTPUT = "data/graph/memory_graph.json"

def build_graph():

    if not os.path.exists(INPUT):
        print("[AETHER] No processed dataset found")
        return

    df = pd.read_csv(INPUT)

    print(f"[AETHER] Loaded {len(df)} events")

    nodes = {}
    edges = []

    # ensure root user node exists
    nodes["avi"] = {"id": "avi", "type": "person"}

    topic_counts = defaultdict(int)

    for _, row in df.iterrows():

        topic = str(row.get("topic", "general")).lower()

        topic_counts[topic] += 1

        # create topic node
        if topic not in nodes:
            nodes[topic] = {
                "id": topic,
                "type": "topic"
            }

        # edge: avi studied topic
        edges.append({
            "from": "avi",
            "to": topic,
            "relation": "interacted_with",
            "timestamp": row.get("timestamp")
        })

        # study relation
        if row.get("is_study_session") == True:

            edges.append({
                "from": "avi",
                "to": topic,
                "relation": "studied"
            })

        # goal relation
        if row.get("is_goal_mention") == True:

            edges.append({
                "from": "avi",
                "to": topic,
                "relation": "goal_related"
            })

    graph = {
        "nodes": list(nodes.values()),
        "edges": edges,
        "topic_frequency": topic_counts
    }

    os.makedirs("data/graph", exist_ok=True)

    with open(OUTPUT, "w") as f:
        json.dump(graph, f, indent=2)

    print(f"[AETHER] Memory graph written → {OUTPUT}")
    print(f"[AETHER] Nodes: {len(nodes)}")
    print(f"[AETHER] Edges: {len(edges)}")

if __name__ == "__main__":
    build_graph()