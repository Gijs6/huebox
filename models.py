from flask_sqlalchemy import SQLAlchemy

import secrets
import string
from datetime import datetime


def generate_id(length=5):
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    github_id = db.Column(db.Integer, unique=True, nullable=False)
    login = db.Column(db.String(100), nullable=False)
    avatar_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.now)

    palettes = db.relationship(
        "Palette", backref="owner", cascade="all, delete-orphan", lazy=True
    )


class Palette(db.Model):
    id = db.Column(db.String(5), primary_key=True, default=generate_id)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    is_public = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    colors = db.relationship(
        "Color",
        backref="palette",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="Color.position",
    )
    likes = db.relationship(
        "Like", backref="palette_obj", cascade="all, delete-orphan", lazy=True
    )

    @property
    def like_count(self):
        return len(self.likes)


class Color(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    palette_id = db.Column(db.String(5), db.ForeignKey("palette.id"), nullable=False)
    hex_value = db.Column(db.String(7), nullable=False)
    position = db.Column(db.Integer, nullable=False)


class Like(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), primary_key=True)
    palette_id = db.Column(db.String(5), db.ForeignKey("palette.id"), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
