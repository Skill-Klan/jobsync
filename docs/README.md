# SkillKlan Job — documentation

For people and agents working on this repository. Start with [CLAUDE.md](../CLAUDE.md) (rules and commands)
and [CONTRIBUTING.md](../CONTRIBUTING.md) (setup and pull requests).

| Page | What |
|---|---|
| [decisions.md](./decisions.md) | The owner's decisions that shape the code — follow them literally |
| [glossary.md](./glossary.md) | How the interface is translated into Ukrainian |
| [contracts/](./contracts/README.md) | Every HTTP contract with the SkillKlan backend, and how to ask for a new one |
| [contracts/local-backend.md](./contracts/local-backend.md) | A local stand-in for the backend: cabinet sign-in, roles, access |
| [feature-switches.md](./feature-switches.md) | Settings → «Функції»: what each switch hides, how to add one |
| [interview-recordings.md](./interview-recordings.md) | «Співбесіди»: how the recordings library works and how it is set up |

The [README](../README.md) says what is on, where things are and how a release reaches production.

This folder documents the code and its contracts only. No server addresses beyond the public domains, no
secrets, no personal data, no paths of anyone's machine — a test (`__tests__/skillklan/contributorGuide.spec.ts`)
fails the build if they appear.
