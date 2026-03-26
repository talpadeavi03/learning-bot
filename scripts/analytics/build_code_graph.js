const fs = require("fs")
const path = require("path")
const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default

const SOURCE_DIRS = ["api","scripts"]

const nodes = []
const edges = []

const IGNORE = new Set([
  "console",
  "String",
  "Number",
  "Math",
  "Date",
  "JSON"
])

function scanDir(dir){

  const files = fs.readdirSync(dir)

  for(const file of files){

    const full = path.join(dir,file)
    const stat = fs.statSync(full)

    if(stat.isDirectory()){
      scanDir(full)
      continue
    }

    if(!file.endsWith(".js")) continue

    analyzeFile(full)

  }

}

function analyzeFile(filePath){

  const code = fs.readFileSync(filePath,"utf8")

  const ast = parser.parse(code,{
    sourceType:"module",
    plugins:["asyncGenerators"]
  })

  traverse(ast,{

    FunctionDeclaration(pathNode){

      const fnName = pathNode.node.id.name

      nodes.push({
        name:fnName,
        file:filePath
      })

      pathNode.traverse({

        CallExpression(callPath){

          const callee = callPath.node.callee

          if(callee.type === "Identifier"){

            const called = callee.name

            if(!IGNORE.has(called)){

              edges.push({
                from:fnName,
                to:called
              })

            }

          }

          if(callee.type === "MemberExpression" && callee.property){

            const called = callee.property.name

            if(!IGNORE.has(called)){

              edges.push({
                from:fnName,
                to:called
              })

            }

          }

        }

      })

    }

  })

}

SOURCE_DIRS.forEach(scanDir)

const graph = {nodes,edges}

if(!fs.existsSync("data")) fs.mkdirSync("data")

fs.writeFileSync(
  "data/code_graph.json",
  JSON.stringify(graph,null,2)
)

console.log("Graph built")
console.log("Nodes:",nodes.length)
console.log("Edges:",edges.length)