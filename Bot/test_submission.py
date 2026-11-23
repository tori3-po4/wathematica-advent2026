import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from pydantic import ValidationError

from main import submission
from models import Article

PNG = bytes.fromhex("89504e470d0a1a0a0000000d494844520000000100000001")
PDF = b"%PDF-1.4\nfixture"


def attachment(filename, data):
    return SimpleNamespace(
        filename=filename, size=len(data), read=AsyncMock(return_value=data)
    )


class SubmissionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.interaction = SimpleNamespace(
            client=SimpleNamespace(settings=SimpleNamespace()),
            response=SimpleNamespace(defer=AsyncMock()),
            followup=SimpleNamespace(send=AsyncMock()),
        )
        self.fields = dict(
            date="2026-12-01",
            title="記事",
            author="著者",
            icon=attachment("icon.png", PNG),
            abstract="**概要**\n<script>alert(1)</script>",
        )

    async def submit(self, **content):
        with patch(
            "main.upload_article", new_callable=AsyncMock, return_value="abcdef0123"
        ) as upload:
            await submission.callback(self.interaction, **self.fields, **content)
        return upload

    def test_command_offers_only_pdf_and_external(self):
        parameter = next(
            item for item in submission.parameters if item.name == "content_type"
        )
        self.assertEqual(
            {choice.value for choice in parameter.choices}, {"pdf", "external"}
        )

    async def test_pdf_and_external_submissions_preserve_plain_text(self):
        for content in [
            dict(content_type="pdf", content_file=attachment("body.PDF", PDF)),
            dict(content_type="external", url="https://example.com/article"),
        ]:
            with self.subTest(content_type=content["content_type"]):
                upload = await self.submit(**content)
                upload.assert_awaited_once()
                _, article, files = upload.call_args.args
                prefix = f"Front/content/{article.id}/"
                expected_files = {prefix + "icon.png", prefix + "article.json"}
                if content["content_type"] == "pdf":
                    expected_files.add(prefix + "article.pdf")
                    self.assertEqual(files[prefix + "article.pdf"], PDF)
                else:
                    self.assertEqual(str(article.content.url), content["url"])
                self.assertEqual(set(files), expected_files)
                metadata = json.loads(files[prefix + "article.json"])
                self.assertEqual(metadata["abstract"], self.fields["abstract"])
                self.assertEqual(metadata["content"]["type"], content["content_type"])
                self.assertIn(
                    "was submitted", self.interaction.followup.send.call_args.args[0]
                )

    async def test_invalid_body_submissions_are_not_uploaded(self):
        for content in [
            dict(
                content_type="markdown", content_file=attachment("body.md", b"# Body")
            ),
            dict(content_type="pdf", content_file=attachment("body.md", b"# Body")),
            dict(
                content_type="pdf", content_file=attachment("body.markdown", b"# Body")
            ),
            dict(content_type="pdf", content_file=attachment("body.pdf", b"not a PDF")),
            dict(content_type="pdf"),
            dict(
                content_type="pdf",
                content_file=attachment("body.pdf", PDF),
                url="https://example.com",
            ),
            dict(
                content_type="external",
                content_file=attachment("body.pdf", PDF),
                url="https://example.com",
            ),
            dict(content_type="external", url="http://example.com"),
        ]:
            with self.subTest(content=content):
                upload = await self.submit(**content)
                upload.assert_not_awaited()
                self.assertNotIn(
                    "was submitted", self.interaction.followup.send.call_args.args[0]
                )

    def test_article_schema_rejects_markdown(self):
        with self.assertRaises(ValidationError):
            Article(
                id="example",
                icon="content/example/icon.png",
                **{key: value for key, value in self.fields.items() if key != "icon"},
                content={"type": "markdown", "path": "content/example/article.md"},
            )


if __name__ == "__main__":
    unittest.main()
