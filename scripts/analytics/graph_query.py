import json
from pathlib import Path

GRAPH = "data/graph/knowledge_graph.json"


def query(topic):

    if not Path(GRAPH).exists():
        return []

    with open(GRAPH) as f:
        graph = json.load(f)

    topic = topic.lower()

    return graph.get(topic, [])