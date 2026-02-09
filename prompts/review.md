---
description: Review the current PR focusing on production risks and save findings to a markdown file.
---

1. Retrieve the full details of the current pull request by running `gh pr view`.
2. Retrieve the code changes associated with the PR by running `git diff`.
3. Analyze the PR description and the code diff, specifically looking for bugs, security vulnerabilities, or logic errors that could cause the project to break in a production environment.
4. Create a new markdown file named `PR_REVIEW.md` (or overwrite it if it exists).
5. Write your review findings into `PR_REVIEW.md`. Structure the report clearly, prioritizing critical issues. If no critical issues are found, state that the code looks safe for production but include any other relevant observations.
6. Post the review as a comment on the PR using `gh pr comment --body-file PR_REVIEW.md`.
