from flask import (
    Flask,
    render_template,
)

import os

from dotenv import load_dotenv

from models import db, Palette

load_dotenv(override=True)

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", os.urandom(256).hex())
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DB_URI", "sqlite:///huebox.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()


@app.get("/")
def index():
    palettes = Palette.query.all()

    return render_template(
        "index.jinja",
        palettes=palettes,
    )


@app.get("/new")
def new():
    return render_template("new.jinja")


if __name__ == "__main__":
    app.run(debug=True, port=7000, host="0.0.0.0")
