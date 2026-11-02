from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

import discord
from discord import app_commands
from pydantic import ValidationError

from github import upload_article
from models import Article, Settings

MAX_ICON_BYTES = 2 * 1024 * 1024
MAX_BODY_BYTES = 20 * 1024 * 1024


async def read_attachment(attachment: discord.Attachment, extensions: set[str], limit: int) -> bytes:
    extension = Path(attachment.filename).suffix.lower()
    if extension not in extensions:
        raise ValueError(f"Expected an attachment with extension: {', '.join(sorted(extensions))}")
    if not 0 < attachment.size <= limit:
        raise ValueError(f"Attachment size must be between 1 byte and {limit // (1024 * 1024)} MiB")
    data = await attachment.read()
    if not 0 < len(data) <= limit:
        raise ValueError("Downloaded attachment size is outside the allowed limit")
    if extension == ".png":
        if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            raise ValueError("Invalid PNG icon")
        width, height = int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
        if not width or not height or width * height > 16_000_000:
            raise ValueError("PNG icons must not exceed 16 million pixels")
    elif extension == ".pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF file")
    elif "\x00" in data.decode("utf-8"):
        raise ValueError("Markdown files must not contain NUL characters")
    return data


class ArticleBot(discord.Client):
    def __init__(self, settings: Settings):
        super().__init__(intents=discord.Intents.none())
        self.settings = settings
        self.tree = app_commands.CommandTree(self)
        self.tree.add_command(submission)

    async def setup_hook(self):
        await self.tree.sync()


@app_commands.command(name="submission", description="Submit an Advent Calendar article")
@app_commands.describe(
    id="Unique article ID", date="Publication date (YYYY-MM-DD)", title="Article title",
    author="Author name", icon="PNG icon", abstract="Abstract in Markdown",
    content_type="Body type", url="External article URL", content_file="PDF or Markdown body",
)
async def submission(
    interaction: discord.Interaction,
    id: str, date: str, title: str, author: str, icon: discord.Attachment, abstract: str,
    content_type: Literal["external", "pdf", "markdown"],
    url: str | None = None, content_file: discord.Attachment | None = None,
):
    settings = interaction.client.settings
    roles = {role.id for role in getattr(interaction.user, "roles", [])}
    if interaction.user.id not in settings.discord_allowed_user_ids and not roles & settings.discord_allowed_role_ids:
        await interaction.response.send_message("You are not authorized to submit articles.", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True, thinking=True)
    try:
        id = id.strip()
        if content_type == "external":
            if content_file is not None:
                raise ValueError("External articles must not include a body file")
            content = {"type": "external", "url": url}
        else:
            if content_file is None or url is not None:
                raise ValueError("PDF and Markdown articles require a body attachment and no URL")
            extension = ".pdf" if content_type == "pdf" else ".md"
            content = {"type": content_type, "path": f"content/{id}/article{extension}"}

        # Only the validated ID and fixed filenames determine repository paths.
        article = Article(
            id=id, date=date, title=title, author=author, abstract=abstract,
            icon=f"content/{id}/icon.png", content=content,
        )
        files = {f"Front/{article.icon}": await read_attachment(icon, {".png"}, MAX_ICON_BYTES)}
        if content_file is not None:
            extensions = {".pdf"} if content_type == "pdf" else {".md", ".markdown"}
            files[f"Front/{article.content.path}"] = await read_attachment(content_file, extensions, MAX_BODY_BYTES)
        files[f"Front/content/{id}/article.json"] = (article.model_dump_json(indent=2) + "\n").encode()
        sha = await upload_article(settings, article, files)
        message = f"Article `{id}` was submitted in commit `{sha[:7]}`."
    except ValidationError as exc:
        message = "\n".join(
            f"{'.'.join(map(str, error['loc']))}: {error['msg']}"
            for error in exc.errors(include_input=False, include_url=False)
        )[:1800]
    except ValueError as exc:
        message = str(exc)[:1800]
    except Exception:
        logging.exception("Article submission failed")
        message = "Submission failed. Check the bot logs and whether the article was saved before retrying."
    await interaction.followup.send(message, ephemeral=True, allowed_mentions=discord.AllowedMentions.none())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    settings = Settings.from_environment()
    ArticleBot(settings).run(settings.discord_token.get_secret_value())
