from models import db
from models.person import Person
from models.face import Face
from models.photo import Photo


def get_persons(user_id: int) -> list[dict]:
    """Get all persons for a user, logging counts for debugging."""
    persons = Person.query.filter_by(user_id=user_id).order_by(Person.name).all()
    print(f"[DEBUG] Listing {len(persons)} persons for user {user_id}")
    for p in persons:
        print(f"[DEBUG] Person: {p.name}, Face count: {p.faces.count()}")
    
    # We'll filter in Python to be very explicit and safe
    result = [p.to_dict() for p in persons if p.faces.count() > 0]
    print(f"[DEBUG] Returning {len(result)} persons after filtering 0-photo entries.")
    return result


def get_person_photos(person_id: int, user_id: int) -> list[dict]:
    """Get all photos containing a specific person."""
    person = Person.query.filter_by(id=person_id, user_id=user_id).first()
    if not person:
        return []

    # Get unique photos where this person's face appears
    photo_ids = (
        db.session.query(Face.photo_id)
        .filter(Face.person_id == person_id)
        .distinct()
        .all()
    )
    photo_ids = [pid[0] for pid in photo_ids]

    if not photo_ids:
        return []

    photos = Photo.query.filter(Photo.id.in_(photo_ids)).order_by(Photo.uploaded_at.desc()).all()
    return [p.to_dict() for p in photos]


def create_person(user_id: int, name: str) -> dict:
    """Create a new person."""
    existing = Person.query.filter_by(user_id=user_id, name=name).first()
    if existing:
        return existing.to_dict()

    person = Person(user_id=user_id, name=name)
    db.session.add(person)
    db.session.commit()
    return person.to_dict()


def delete_person(person_id: int, user_id: int) -> bool:
    """Delete a person (unlinks faces but doesn't delete them)."""
    person = Person.query.filter_by(id=person_id, user_id=user_id).first()
    if not person:
        return False

    # Unlink all faces from this person
    Face.query.filter_by(person_id=person_id).update({"person_id": None})
    db.session.delete(person)
    db.session.commit()
    return True
