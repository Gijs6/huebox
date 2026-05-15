from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    flash,
)

import os
from functools import wraps
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
from werkzeug.middleware.proxy_fix import ProxyFix

from models import db, User, Palette, Color, Like

load_dotenv(override=True)

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

app.secret_key = os.getenv("SECRET_KEY", os.urandom(256).hex())
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DB_URI", "sqlite:///huebox.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

oauth = OAuth(app)
github = oauth.register(
    name="github",
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "read:user"},
)

with app.app_context():
    db.create_all()
    with db.engine.connect() as conn:
        cols = [r[1] for r in conn.execute(db.text("PRAGMA table_info(palette)"))]
        if "user_id" not in cols:
            conn.execute(
                db.text(
                    "ALTER TABLE palette ADD COLUMN user_id INTEGER REFERENCES user(id)"
                )
            )
            conn.commit()
        if "is_public" not in cols:
            conn.execute(
                db.text(
                    "ALTER TABLE palette ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 0"
                )
            )
            conn.commit()


@app.before_request
def auto_login_in_debug():
    if not app.debug or "user_id" in session or session.get("dev_logged_out"):
        return
    dev_user = User.query.filter_by(github_id=0).first()
    if dev_user is None:
        dev_user = User(github_id=0, login="devuser", avatar_url=None)
        db.session.add(dev_user)
        db.session.commit()
    session["user_id"] = dev_user.id


def current_user():
    uid = session.get("user_id")
    if uid is None:
        return None
    return db.session.get(User, uid)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user() is None:
            return redirect(url_for("index"))
        return f(*args, **kwargs)

    return decorated


@app.context_processor
def inject_user():
    return {"current_user": current_user()}


@app.get("/login")
def login():
    if app.debug:
        session.pop("dev_logged_out", None)
        return redirect(url_for("list"))
    callback = url_for("auth_callback", _external=True)
    return github.authorize_redirect(callback)


@app.get("/auth/callback")
def auth_callback():
    token = github.authorize_access_token()
    resp = github.get("user", token=token)
    data = resp.json()

    user = User.query.filter_by(github_id=data["id"]).first()
    if user is None:
        user = User(
            github_id=data["id"],
            login=data["login"],
            avatar_url=data.get("avatar_url"),
        )
        db.session.add(user)
    else:
        user.login = data["login"]
        user.avatar_url = data.get("avatar_url")

    db.session.commit()
    session["user_id"] = user.id
    return redirect(url_for("list"))


@app.get("/logout")
def logout():
    session.clear()
    if app.debug:
        session["dev_logged_out"] = True
    return redirect(url_for("index"))


@app.get("/")
def index():
    if current_user() is not None:
        return redirect(url_for("list"))
    return render_template("index.jinja")


@app.get("/explore")
def explore():
    palettes = (
        Palette.query.filter_by(is_public=True)
        .order_by(Palette.created_at.desc())
        .limit(200)
        .all()
    )
    user = current_user()
    liked_ids = set()
    if user:
        liked_ids = {l.palette_id for l in Like.query.filter_by(user_id=user.id).all()}
    return render_template("explore.jinja", palettes=palettes, liked_ids=liked_ids)


@app.get("/p/<id>")
def view_palette(id):
    p = Palette.query.filter_by(id=id, is_public=True).first_or_404()
    user = current_user()
    user_liked = bool(
        user and Like.query.filter_by(user_id=user.id, palette_id=id).first()
    )
    return render_template("view.jinja", palette=p, user_liked=user_liked)


@app.get("/list")
@login_required
def list():
    user = current_user()
    palettes = (
        Palette.query.filter_by(user_id=user.id)
        .order_by(Palette.created_at.desc())
        .all()
    )
    return render_template("list.jinja", palettes=palettes)


@app.get("/new")
@login_required
def new():
    return render_template("edit.jinja")


@app.post("/new")
@login_required
def submit_new():
    colors = request.form.getlist("colors")
    name = request.form.get("name")
    is_public = "is_public" in request.form
    user = current_user()

    palette = Palette(name=name, user_id=user.id, is_public=is_public)
    db.session.add(palette)
    db.session.flush()

    for index, hex_value in enumerate(colors):
        db.session.add(
            Color(palette_id=palette.id, hex_value=hex_value, position=index)
        )

    db.session.commit()
    return redirect(url_for("palette", id=palette.id))


@app.get("/palette/<id>")
@login_required
def palette(id):
    user = current_user()
    p = Palette.query.filter_by(id=id, user_id=user.id).first_or_404()
    return render_template("edit.jinja", palette=p)


@app.post("/palette/<id>")
@login_required
def submit_palette(id):
    user = current_user()
    p = Palette.query.filter_by(id=id, user_id=user.id).first_or_404()

    p.name = request.form.get("name")
    p.is_public = "is_public" in request.form
    colors = request.form.getlist("colors")

    Color.query.filter_by(palette_id=p.id).delete()
    for index, hex_value in enumerate(colors):
        db.session.add(Color(palette_id=p.id, hex_value=hex_value, position=index))

    db.session.commit()
    flash("Saved.", "success")
    return redirect(url_for("palette", id=p.id))


@app.post("/palette/<id>/delete")
@login_required
def delete_palette(id):
    user = current_user()
    p = Palette.query.filter_by(id=id, user_id=user.id).first_or_404()
    db.session.delete(p)
    db.session.commit()
    return redirect(url_for("list"))


@app.post("/palette/<id>/duplicate")
@login_required
def duplicate_palette(id):
    user = current_user()
    source = Palette.query.filter_by(id=id, user_id=user.id).first_or_404()

    copy = Palette(name=f"{source.name} (copy)", user_id=user.id, is_public=False)
    db.session.add(copy)
    db.session.flush()

    for color in source.colors:
        db.session.add(
            Color(
                palette_id=copy.id, hex_value=color.hex_value, position=color.position
            )
        )

    db.session.commit()
    return redirect(url_for("palette", id=copy.id))


@app.post("/palette/<id>/fork")
@login_required
def fork_palette(id):
    source = Palette.query.filter_by(id=id, is_public=True).first_or_404()
    user = current_user()

    fork = Palette(name=source.name, user_id=user.id, is_public=False)
    db.session.add(fork)
    db.session.flush()

    for color in source.colors:
        db.session.add(
            Color(
                palette_id=fork.id, hex_value=color.hex_value, position=color.position
            )
        )

    db.session.commit()
    flash(f'Forked "{source.name}" to your palettes.', "success")
    return redirect(url_for("palette", id=fork.id))


@app.post("/palette/<id>/like")
@login_required
def toggle_like(id):
    p = Palette.query.filter_by(id=id, is_public=True).first_or_404()
    user = current_user()
    existing = Like.query.filter_by(user_id=user.id, palette_id=id).first()
    if existing:
        db.session.delete(existing)
    else:
        db.session.add(Like(user_id=user.id, palette_id=id))
    db.session.commit()
    return redirect(request.referrer or url_for("view_palette", id=id))


@app.errorhandler(404)
def not_found(e):
    return render_template(
        "error.jinja",
        code=404,
        title="Not Found",
        description="The page you're looking for doesn't exist.",
    ), 404


@app.errorhandler(403)
def forbidden(e):
    return render_template(
        "error.jinja",
        code=403,
        title="Forbidden",
        description="You don't have permission to view this page.",
    ), 403


@app.errorhandler(500)
def server_error(e):
    return render_template(
        "error.jinja",
        code=500,
        title="Server Error",
        description="Something went wrong on our end. Please try again later.",
    ), 500


if __name__ == "__main__":
    app.run(debug=True, port=7000, host="0.0.0.0")
