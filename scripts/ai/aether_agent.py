import os
import sys

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.ai.agent_router import route


def main():
    if len(sys.argv) > 1:
        if sys.argv[1] in ("-i", "--interactive") and sys.stdin.isatty():
            question = input("Ask AETHER: ")
        else:
            question = " ".join(sys.argv[1:])
    else:
        question = "What is my current flow state and productivity?"

    print("\n--- AETHER RESPONSE ---\n")

    response = route(question)

    print(response)


if __name__ == "__main__":
    main()