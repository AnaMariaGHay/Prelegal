import json
from pathlib import Path

from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from app.models import Template


def slug_for(filename: str) -> str:
    return Path(filename).stem.lower()


def refresh_templates(engine: Engine, catalog_file: Path, templates_dir: Path) -> int:
    """Replace the templates table with every catalog entry and its markdown content.

    Templates live in files, so they're reloaded on each startup rather than migrated.
    Users and their drafts are left alone. Returns the number of templates loaded.
    """
    entries = json.loads(catalog_file.read_text(encoding="utf-8"))
    with Session(engine) as session, session.begin():
        session.execute(delete(Template))
        session.add_all(
            Template(
                slug=slug_for(entry["filename"]),
                name=entry["name"],
                description=entry["description"],
                filename=entry["filename"],
                content=(templates_dir / entry["filename"]).read_text(encoding="utf-8"),
            )
            for entry in entries
        )
    return len(entries)
