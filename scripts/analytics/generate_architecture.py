import json
import os
import shutil

path = "data/code_graph.json"

if not os.path.exists(path):
    print("code_graph.json not found — skipping")
    exit(0)

if os.stat(path).st_size == 0:
    print("code_graph.json empty — skipping")
    exit(0)

# COPY GRAPH TO SITE (IMPORTANT)
os.makedirs("site/data", exist_ok=True)
shutil.copy(path, "site/data/code_graph.json")

with open(path) as f:
    graph = json.load(f)

nodes = graph.get("nodes", [])
edges = graph.get("edges", [])

html = f"""
<html>
<head>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>

<h2>AETHER System Brain</h2>

<div id="network" style="width:100%;height:800px;"></div>

<script>

var nodes = new vis.DataSet({json.dumps(nodes)});
var edges = new vis.DataSet({json.dumps(edges)});

var container = document.getElementById('network');

var data = {{
  nodes: nodes,
  edges: edges
}};

var options = {{
  layout:{{improvedLayout:true}},
  physics:{{enabled:true}}
}};

new vis.Network(container, data, options);

</script>

</body>
</html>
"""

os.makedirs("docs", exist_ok=True)

with open("docs/aether-live-architecture.html","w") as f:
    f.write(html)

print("Architecture page generated.")