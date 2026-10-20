"""WER on two local UTF-8 texts. No transcript content is printed.
Usage: python web/tests/score_wer.py reference.txt hypothesis.txt
Rules: lowercase Unicode words; punctuation removed; numbers kept as spoken/written.
Do not score LLM summaries with WER. Exclude speaker labels/timecodes beforehand.
"""
import json
from pathlib import Path
import re
import sys


def score(reference, hypothesis):
    ref = re.findall(r'\w+', reference.lower(), flags=re.UNICODE)
    hyp = re.findall(r'\w+', hypothesis.lower(), flags=re.UNICODE)
    if not ref:
        raise ValueError('Reference must contain words')
    # Tuple: total distance, substitutions, deletions, insertions. Ties prefer
    # substitution, then deletion, then insertion. Counts are reproducible.
    previous = [(j, 0, 0, j) for j in range(len(hyp) + 1)]
    for i, word in enumerate(ref, 1):
        current = [(i, 0, i, 0)]
        for j, other in enumerate(hyp, 1):
            if word == other:
                current.append(previous[j-1])
                continue
            d, s, deleted, inserted = previous[j-1]
            options = [(d+1, s+1, deleted, inserted)]
            d, s, deleted, inserted = previous[j]
            options.append((d+1, s, deleted+1, inserted))
            d, s, deleted, inserted = current[j-1]
            options.append((d+1, s, deleted, inserted+1))
            current.append(min(options, key=lambda value: value[0]))
        previous = current
    distance, substitutions, deletions, insertions = previous[-1]
    return dict(S=substitutions, D=deletions, I=insertions, N=len(ref), WER=distance/len(ref))


if __name__ == '__main__':
    print(json.dumps(score(*(Path(name).read_text(encoding='utf-8-sig') for name in sys.argv[1:3]))))
