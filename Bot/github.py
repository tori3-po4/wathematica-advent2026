"""Save the article folder in a single GitHub commit."""

import base64
from urllib.parse import quote

import httpx

from models import Article, Settings

MAX_ATTEMPTS = 3


async def upload_article(
    settings: Settings, article: Article, files: dict[str, bytes]
) -> str:
    async with httpx.AsyncClient(
        base_url=f"https://api.github.com/repos/{settings.github_owner}/{settings.github_repo}/",
        headers={
            "Authorization": f"Bearer {settings.github_token.get_secret_value()}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30,
    ) as client:

        async def request(method, path, **kwargs):
            response = await client.request(method, path, **kwargs)
            response.raise_for_status()
            return response.json()

        branch = quote(settings.github_branch, safe="/")
        # Blobs do not depend on the branch head, so create them once and reuse
        # them across retries.
        entries = []
        for path, data in files.items():
            blob = await request(
                "POST",
                "git/blobs",
                json={
                    "content": base64.b64encode(data).decode(),
                    "encoding": "base64",
                },
            )
            entries.append(
                {"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]}
            )

        for _ in range(MAX_ATTEMPTS):
            ref = await request("GET", f"git/ref/heads/{branch}")
            head = ref["object"]["sha"]
            existing = await client.get(
                f"contents/Front/content/{article.id}", params={"ref": head}
            )
            if existing.status_code != 404:
                existing.raise_for_status()
                raise ValueError(f"Article ID '{article.id}' already exists")

            parent = await request("GET", f"git/commits/{head}")
            tree = await request(
                "POST",
                "git/trees",
                json={"base_tree": parent["tree"]["sha"], "tree": entries},
            )
            commit = await request(
                "POST",
                "git/commits",
                json={
                    "message": f"Add article {article.id}",
                    "tree": tree["sha"],
                    "parents": [head],
                },
            )
            # force=False refuses to overwrite a concurrent branch update; GitHub
            # answers 422 in that case, so rebuild the commit on the new head.
            response = await client.patch(
                f"git/refs/heads/{branch}",
                json={"sha": commit["sha"], "force": False},
            )
            if response.status_code != 422:
                response.raise_for_status()
                return commit["sha"]
        raise RuntimeError(
            f"Branch '{settings.github_branch}' kept moving; gave up after "
            f"{MAX_ATTEMPTS} attempts"
        )
