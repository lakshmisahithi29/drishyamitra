from routes.auth import auth_bp
from routes.photos import photos_bp
from routes.faces import faces_bp
from routes.persons import persons_bp
from routes.categories import categories_bp
from routes.tags import tags_bp
from routes.dashboard import dashboard_bp
from routes.chat import chat_bp
from routes.folders import folders_bp


def register_blueprints(app):
    """Register all API route blueprints with the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(photos_bp)
    app.register_blueprint(faces_bp)
    app.register_blueprint(persons_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(tags_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(folders_bp)
