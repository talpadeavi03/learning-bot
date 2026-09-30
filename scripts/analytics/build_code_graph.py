import os
import re
import json

SOURCE_DIRS = ["api", "scripts"]

nodes = []
edges = []
functions = {}

ts_available = False
try:
    from tree_sitter import Parser
    import tree_sitter_javascript
    parser = Parser()
    parser.set_language(tree_sitter_javascript.language())
    ts_available = True
except Exception:
    pass

def walk(node, source, current_fn=None):
    if node.type == "function_declaration":
        name_node = node.child_by_field_name("name")
        if name_node:
            fn = source[name_node.start_byte:name_node.end_byte].decode()
            if fn not in functions:
                functions[fn] = True
                nodes.append({"id": fn, "label": fn})
            current_fn = fn

    if node.type == "call_expression":
        callee = node.child_by_field_name("function")
        if callee and current_fn:
            called = source[callee.start_byte:callee.end_byte].decode()
            edges.append({"from": current_fn, "to": called})

    for child in node.children:
        walk(child, source, current_fn)

def parse_with_regex(source_text):
    fn_pattern = re.compile(r'(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(')
    call_pattern = re.compile(r'([a-zA-Z0-9_$]+)\s*\(')

    declared = fn_pattern.findall(source_text)
    for fn in declared:
        if fn not in functions:
            functions[fn] = True
            nodes.append({"id": fn, "label": fn})

    for fn in declared:
        fn_match = re.search(r'(?:async\s+)?function\s+' + re.escape(fn) + r'\s*\([^)]*\)\s*\{', source_text)
        if fn_match:
            start = fn_match.end()
            chunk = source_text[start:start+1200]
            calls = call_pattern.findall(chunk)
            for c in calls:
                if c != fn and c in declared:
                    edges.append({"from": fn, "to": c})

for src in SOURCE_DIRS:
    for root, dirs, files in os.walk(src):
        for file in files:
            if not file.endswith(".js"):
                continue
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                source = f.read()

            if ts_available:
                try:
                    tree = parser.parse(source.encode())
                    walk(tree.root_node, source.encode())
                except Exception:
                    parse_with_regex(source)
            else:
                parse_with_regex(source)

graph = {
    "nodes": nodes,
    "edges": edges
}

os.makedirs("data", exist_ok=True)
os.makedirs("site/data", exist_ok=True)

with open("data/code_graph.json", "w") as f:
    json.dump(graph, f, indent=2)

with open("site/data/code_graph.json", "w") as f:
    json.dump(graph, f, indent=2)

print("Graph built successfully ✅")
print("Nodes:", len(nodes))
print("Edges:", len(edges))