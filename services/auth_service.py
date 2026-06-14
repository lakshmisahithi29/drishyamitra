from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from models import db
from models.user import User


def register_user(name: str, email: str, password: str) -> tuple[dict, int]:
    """Register a new user. Returns (response_body, status_code)."""
    if User.query.filter_by(email=email).first():
        return {"error": "Email already registered"}, 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return {
        "message": "Account created successfully",
        "token": token,
        "user": user.to_dict(),
    }, 201


def login_user(email: str, password: str) -> tuple[dict, int]:
    """Authenticate a user. Returns (response_body, status_code)."""
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return {"error": "Invalid email or password"}, 401

    token = create_access_token(identity=str(user.id))
    return {
        "message": "Login successful",
        "token": token,
        "user": user.to_dict(),
    }, 200
