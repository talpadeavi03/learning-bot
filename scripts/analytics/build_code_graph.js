const fs = require("fs")
const path = require("path")
const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default

const SOURCE_DIRS = ["api","scripts"]

const nodes = []
const edges = []

const nodeSet = new Set()

const IGNORE = new Set([
  "console",
  "String",
  "Number",
  "Math",
  "Date",
  "JSON"
])

function scanDir(dir){

  if(!fs.existsSync(dir)) return

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

      if(!nodeSet.has(fnName)){
        nodeSet.add(fnName)

        let group = "other"

        if(filePath.includes("site")) group = "ui"
        else if(filePath.includes("api")) group = "api"
        else if(filePath.includes("scripts/ml")) group = "ml"
        else if(filePath.includes("scripts/pipeline")) group = "pipeline"
        else if(filePath.includes("data")) group = "data"

        nodes.push({
          id: fnName,
          label: fnName,
          group: group,
          file: filePath
        })
      }

      pathNode.traverse({

        CallExpression(callPath){

          const callee = callPath.node.callee

          let called = null

          if(callee.type === "Identifier"){
            called = callee.name
          }

          if(callee.type === "MemberExpression" && callee.property){
            called = callee.property.name
          }

          if(called && !IGNORE.has(called)){

            edges.push({
              from: fnName,
              to: called
            })

          }

        }

      })

    }

  })

}

SOURCE_DIRS.forEach(scanDir)

const graph = {nodes,edges}

if(!fs.existsSync("data")) fs.mkdirSync("data",{recursive:true})
if(!fs.existsSync("site/data")) fs.mkdirSync("site/data",{recursive:true})

fs.writeFileSync(
  "data/code_graph.json",
  JSON.stringify(graph,null,2)
)

fs.writeFileSync(
  "site/data/code_graph.json",
  JSON.stringify(graph,null,2)
)

console.log("Graph built")
console.log("Nodes:",nodes.length)
console.log("Edges:",edges.length)