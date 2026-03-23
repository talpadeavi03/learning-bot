import pandas as pd
import json
from pathlib import Path

DATA = "data/processed/events_clean.csv"
OUTPUT = "data/graph/knowledge_graph.json"


def build_graph():

    if not Path(DATA).exists():
        print("[AETHER] dataset missing")
        return

    df = pd.read_csv(DATA)

    graph = {}

    for _, row in df.iterrows():

        topic = str(row.get("topic", "general")).lower()
        text = str(row.get("text", "")).lower()

        words = text.split()

        for w in words:

            if len(w) < 4:
                continue

            graph.setdefault(topic, set()).add(w)

    graph_clean = {k: list(v) for k, v in graph.items()}

    Path("data/graph").mkdir(parents=True, exist_ok=True)

    with open(OUTPUT, "w") as f:
        json.dump(graph_clean, f, indent=2)

    print("[AETHER] knowledge graph built")


if __name__ == "__main__":
    build_graph()