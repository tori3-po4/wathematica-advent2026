"""Article schema and environment configuration."""

import os
from datetime import date as CalendarDate
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    Field,
    HttpUrl,
    PositiveInt,
    SecretStr,
    UrlConstraints,
    field_validator,
    model_validator,
)


class Settings(BaseModel, hide_input_in_errors=True):
    discord_token: SecretStr = Field(min_length=1)
    github_token: SecretStr = Field(min_length=1)
    github_owner: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    github_repo: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
    github_branch: str = Field(default="main", min_length=1)
    discord_allowed_user_ids: set[PositiveInt] = Field(default_factory=set)
    discord_allowed_role_ids: set[PositiveInt] = Field(default_factory=set)

    @field_validator(
        "discord_allowed_user_ids", "discord_allowed_role_ids", mode="before"
    )
    @classmethod
    def parse_ids(cls, value):
        return value.split(",") if isinstance(value, str) and value else value or []

    @model_validator(mode="after")
    def require_submitters(self):
        if not self.discord_allowed_user_ids and not self.discord_allowed_role_ids:
            raise ValueError("Configure at least one allowed Discord user or role ID")
        return self

    @classmethod
    def from_environment(cls):
        return cls.model_validate(
            {
                name: os.environ[name.upper()].strip()
                for name in cls.model_fields
                if name.upper() in os.environ
            }
        )


class ExternalContent(BaseModel, extra="forbid"):
    type: Literal["external"]
    url: Annotated[HttpUrl, UrlConstraints(allowed_schemes=["https"], max_length=2048)]

    @field_validator("url")
    @classmethod
    def no_credentials(cls, value):
        if value.username is not None or value.password is not None:
            raise ValueError("Article URLs must not contain credentials")
        return value


class FileContent(BaseModel, extra="forbid"):
    type: Literal["pdf"]
    path: str


class Article(BaseModel, extra="forbid", str_strip_whitespace=True):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{0,63}$")
    date: CalendarDate
    title: str = Field(min_length=1, max_length=256)
    author: str = Field(min_length=1, max_length=100)
    icon: str
    abstract: str = Field(min_length=1, max_length=4000)
    content: Annotated[ExternalContent | FileContent, Field(discriminator="type")]
