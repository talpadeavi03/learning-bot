import json
import os

path = "data/code_graph.json"

# check if file exists
if not os.path.exists(path):
    print("code_graph.json not found — skipping")
    exit(0)

# check if file empty
if os.stat(path).st_size == 0:
    print("code_graph.json empty — skipping")
    exit(0)

with open(path) as f:
    graph = json.load(f)

nodes = graph.get("nodes", [])
edges = graph.get("edges", [])

html = """
<html>
<head>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>

<h2>AETHER System Brain</h2>

<div id="network" style="width:100%;height:800px;"></div>

<script>

var nodes = new vis.DataSet(%s);
var edges = new vis.DataSet(%s);

var container = document.getElementById('network');

var data = {
  nodes: nodes,
  edges: edges
};

var options = {
  layout:{improvedLayout:true},
  physics:{enabled:true}
};

new vis.Network(container, data, options);

</script>

</body>
</html>
""" % (json.dumps(nodes), json.dumps(edges))

os.makedirs("docs", exist_ok=True)

with open("docs/aether-live-architecture.html","w") as f:
    f.write(html)

print("Architecture page generated.")