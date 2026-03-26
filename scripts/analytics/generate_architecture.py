import json

with open("data/code_graph.json") as f:
    graph = json.load(f)

nodes = graph["nodes"]
edges = graph["edges"]

html = """
<html>
<head>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
</head>
<body>
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

open("docs/aether-live-architecture.html","w").write(html)