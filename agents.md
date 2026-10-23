# Repo rules

1. Do not write tests.
2. Comments in code are forbidden.
3. Documentation is forbidden outside agents.md and README.md. README.md stays concise and simple.
4. Only modify agents.md with Eric's approval.
5. Do not create PRs in draft mode.
6. Tests may be created and run for verification only, inside .scratch/. They are never committed.
7. Do not add GitHub Actions without Eric's approval. Prefer local pre-push checks over paid runners.
8. Run the repo's ci script before every push. It must pass.
9. Never mention the tools, harnesses or assistants used to write the code, and never include private or personally identifying information in the repo, its prompts or its commit messages.
