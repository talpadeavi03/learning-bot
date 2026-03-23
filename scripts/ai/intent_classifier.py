import re

def classify(question):

    q = question.lower()

    if re.search(r"\b(goal|progress|learning)\b", q):
        return "goal"

    if re.search(r"\b(yesterday|today|last week|when did)\b", q):
        return "temporal"

    if re.search(r"\b(pattern|trend|habit)\b", q):
        return "pattern"

    if re.search(r"\b(study|focus|productive)\b", q):
        return "productivity"

    if re.search(r"\b(remember|did i|what did i)\b", q):
        return "memory"

    return "general"