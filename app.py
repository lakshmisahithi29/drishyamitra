"""
Drishyamitra Backend — Flask Application Factory

AI-powered photo management application backend.
"""

import os
from dotenv import load_dotenv

# Load .env file before anything reads environment variables
load_dotenv()

from datetime import timedelta
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db
from models.associations import Category, DEFAULT_CATEGORIES
from routes import register_blueprints


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Ensure required directories exist automatically
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    instance_dir = os.path.join(os.path.dirname(__file__), "instance")
    os.makedirs(instance_dir, exist_ok=True)
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    
    # Robust CORS for development and production
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    jwt = JWTManager(app)
    # Ensure JWT expiration is set correctly
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        seconds=int(app.config.get("JWT_ACCESS_TOKEN_EXPIRES", 86400))
    )

    # Register blueprints
    register_blueprints(app)

    # Serve uploaded files
    @app.route("/uploads/<path:filepath>")
    def serve_upload(filepath):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filepath)

    # Health check
    @app.route("/api/health")
    def health():
        return {"status": "ok", "service": "drishyamitra-backend"}

    # Create tables and seed default categories
    with app.app_context():
        db.create_all()
        _seed_categories()

    return app


def _seed_categories():
    """Seed default categories if they don't exist."""
    for name in DEFAULT_CATEGORIES:
        if not Category.query.filter_by(name=name).first():
            db.session.add(Category(name=name))
    db.session.commit()


# Entry point
app = create_app()

if __name__ == "__main__":
    print("\n  🎯 Drishyamitra Backend")
    print("  ─────────────────────────────────")
    print("  Server:  http://localhost:5000")
    print("  Health:  http://localhost:5000/api/health")
    print("  ─────────────────────────────────\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
