import os
import json
from tree_sitter import Parser
import tree_sitter_javascript

SOURCE_DIRS = ["api", "scripts"]

parser = Parser()
parser.set_language(tree_sitter_javascript.language())

nodes = []
edges = []
functions = {}

def walk(node, source, current_fn=None):

    if node.type == "function_declaration":

        name_node = node.child_by_field_name("name")

        if name_node:
            fn = source[name_node.start_byte:name_node.end_byte].decode()

            functions[fn] = True
            nodes.append({
                "name": fn
            })

            current_fn = fn

    if node.type == "call_expression":

        callee = node.child_by_field_name("function")

        if callee and current_fn:

            called = source[callee.start_byte:callee.end_byte].decode()

            edges.append({
                "from": current_fn,
                "to": called
            })

    for child in node.children:
        walk(child, source, current_fn)


for src in SOURCE_DIRS:

    for root, dirs, files in os.walk(src):

        for file in files:

            if not file.endswith(".js"):
                continue

            path = os.path.join(root, file)

            with open(path, "rb") as f:
                source = f.read()

            tree = parser.parse(source)

            walk(tree.root_node, source)

graph = {
    "nodes": nodes,
    "edges": edges
}

os.makedirs("data", exist_ok=True)

with open("data/code_graph.json", "w") as f:
    json.dump(graph, f, indent=2)

print("Graph built")
print("Nodes:", len(nodes))
print("Edges:", len(edges))