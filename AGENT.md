## Project Overview 
This repo hosts a software for Wathematica Advent Calender 2026.
Given the current situation, I have adopted an architecture that allows for posting articles without needing to log in, using a Discord bot and GitHub Actions.
## Repository Map
The directory structure of this repository is as follows:
```
.
├── AGENT.md
├── Bot
├── flake.nix
├── Front
└── README.md
```
- Bot Directory : This directory contains an implementation of a bot that posts articles using discord.py and the GitHub REST API.
- Front : Static pages that are actually deployed to Vercel or Cloudflare. I plan to use either Next.js or Astro.
- README.md : An incomplete README
- flake.nix : defines the environment

## Architectural Invariants
The following constraints must be preserved when making architectural or implementation changes.
Frontend
- The frontend must support static generation and deployment.
- The deployed frontend must not require a runtime application server, user authentication, or database connections.
- Article content must be managed through files in the Git repository rather than a database.
Bot
- The bot must interact with GitHub through the GitHub REST API.
- Secrets and credentials must be provided through environment variables. Never hardcode or commit them.
- All external inputs must be validated before processing.
- Validate article metadata, file types, file sizes, URLs, and file paths as appropriate.
- Restrict article submission operations to authorized Discord users or roles.
- Use the minimum GitHub permissions necessary for repository updates.
Content
Each article must support the following metadata and content:
- Author name
- Author icon (image)
- Abstract (plain text)
- Article body (PDF or external URL)
The exact content schema and storage layout have not yet been finalized. Do not introduce incompatible assumptions without discussing them first.
## Prohibitions
- Do not create Git commits, push changes, rewrite Git history, or modify remote branches.
- Installing libraries or software without authorization
- Deleting files without permission
- Do not introduce new external services or infrastructure dependencies.
- Do not change the project's architectural invariants.

## Development Commands
To enable developement environment :
```
nix develop
```
Prefer tools provided by the Nix development environment.

Do not modify flake.nix or flake.lock solely to install additional dependencies without authorization.
