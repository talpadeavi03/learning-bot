import json
import os

data_file = "site/data/dashboard.json"

if not os.path.exists(data_file):
    print("dashboard data not found")
    exit()

with open(data_file) as f:
    data = json.load(f)

topics = data.get("topics", {})

insight = []
suggestions = []

# find dominant topic
if topics:

    top_topic = max(topics, key=topics.get)

    if top_topic == "DevOps":
        insight.append("You focused heavily on DevOps topics this week.")

        suggestions = [
            "Kubernetes ingress",
            "Service mesh (Istio / Linkerd)",
            "Infrastructure as Code pipelines"
        ]

    elif top_topic == "MLOps":
        insight.append("Your focus was mainly on MLOps experimentation.")

        suggestions = [
            "MLflow model registry",
            "Feature stores",
            "CI/CD for ML pipelines"
        ]

    elif top_topic == "Projects":
        insight.append("You spent most of your time building projects.")

        suggestions = [
            "Project architecture documentation",
            "Automated testing pipelines",
            "Production deployment strategies"
        ]

else:
    insight.append("No strong learning pattern detected yet.")


summary = {
    "insight": insight,
    "suggested_topics": suggestions
}

data["ai_summary"] = summary

with open(data_file, "w") as f:
    json.dump(data, f, indent=4)

print("AI summary generated")