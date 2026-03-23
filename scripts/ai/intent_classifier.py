import re

def classify(question):

    q = question.lower()

    # productivity questions
    if re.search(r"\b(study|focus|productive|deep work)\b", q):
        return "productivity"

    # temporal questions
    if re.search(r"\b(yesterday|today|last week|when did)\b", q):
        return "temporal"

    # pattern questions
    if re.search(r"\b(pattern|trend|habit)\b", q):
        return "pattern"

    # memory questions
    if re.search(r"\b(remember|did i|what did i)\b", q):
        return "memory"

    return "general"