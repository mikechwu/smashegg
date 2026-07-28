# Pre-registration template

Copy this file, fill it in, and commit it **before** running the thing it judges. Two
pre-registrations in this project have used the structure below (`prereg-fan-model.md`,
`prereg-descending-holdout.md`); the first one FAILED its own distribution test, which is
the strongest argument that the structure works.

A pre-registration is immutable once the data exists. Record the outcome by **appending an
OUTCOME banner above the unchanged text**, never by editing a prediction. Editing one to
match the result is the exact retrofitting the document exists to prevent, and it is why
these files are exempt from the withdrawn-figure scanner.

---

## 1. What is being tested, in one sentence

Name the model or claim, and the decision that depends on it. If no decision depends on it,
say so — that is allowed, and it changes how the outcome should be read.

## 2. Configuration, pinned and declared

Every axis, with its value and a justification for any value that is not the product
default. Use `scripts/axes.mjs` as the checklist; an axis you do not name is an axis you
will later discover you varied. State the viewport as an INNER dimension.

## 3. The predictions, fixed now

The numbers the model produces, written down before the data. Bins, rates, thresholds.

## 4. Agreement criteria

Each criterion as a pass/fail condition with its tolerance, numbered, stated so that a
reader could evaluate them without you.

## 5. Distribution power — what this n can and cannot detect

**This section is required, and it is the one most recently added.** A distribution test
that passes tells you nothing on its own: a small sample cannot reject a wrong model, so
"the distribution matched" is a claim about the sample size as much as about the model.
Practice 25 says to declare whether a sample answers DETECTION or EQUIVALENCE; this is that
rule applied to a goodness-of-fit test rather than to a rate.

State, before running:

- **The planned n**, and why it is that number rather than a larger one.
- **The bins that will carry the test** — those with an expected count of at least 5 — and
  the bins that will not. Name them. *Everything outside that set is unvalidated by this
  test even if the test passes*, and the range that comes out of it is what
  `status/VALIDATED.md` will record as the quantity's validity range.
- **The smallest discrepancy this n could detect** at the stated criteria: what does a
  wrong model have to look like before this test notices? Give it as a concrete
  alternative — "a model whose mass in the 294.7px bin is off by 10 points would fail
  criterion 2" — not as a power figure in the abstract.
- **What a PASS will therefore license**, in one sentence, and what it will not.

The failure this prevents is specific and has happened here: a model was validated on bins
with expected count >= 5, and the validated mechanism was then used to discriminate two
candidates at 0.08% and 0.74% — two orders of magnitude below the smallest bin the test
ever saw. The test was fine. The extrapolation from it was not, and nothing in the
pre-registration said where the evidence stopped.

## 6. What each outcome means

Written before the outcome is known, for every outcome including the awkward ones. A
pre-registration that only describes what a pass means is half a document.

## 7. What this does NOT establish

The limits, stated by the author rather than discovered by a reader.
