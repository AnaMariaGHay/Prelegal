from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Template(Base):
    """A legal agreement template from templates/, as listed in catalog.json."""

    __tablename__ = "templates"

    # URL-friendly id derived from the filename, e.g. "Mutual-NDA.md" -> "mutual-nda".
    slug: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str] = mapped_column(Text)
    filename: Mapped[str]
    content: Mapped[str] = mapped_column(Text)
