import json
from pathlib import Path

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.db import Base
from app.models import Template


def slug_for(filename: str) -> str:
    return Path(filename).stem.lower()


def reset_and_seed(engine: Engine, catalog_file: Path, templates_dir: Path) -> int:
    """Recreate the tables and load every catalog entry with its markdown content.

    The database is temporary, so it is rebuilt from the files on each startup
    rather than migrated. Returns the number of templates loaded.
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    entries = json.loads(catalog_file.read_text(encoding="utf-8"))
    with Session(engine) as session:
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
        session.commit()
    return len(entries)
