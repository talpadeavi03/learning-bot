import os
import sys

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.ai.agent_router import route


def main():

    question = input("Ask AETHER: ")

    print("\n--- AETHER RESPONSE ---\n")

    response = route(question)

    print(response)


if __name__ == "__main__":
    main()