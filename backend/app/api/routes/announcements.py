import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementOut, AnnouncementUpdate

router = APIRouter(prefix="/api", tags=["announcements"])


@router.get("/announcements", response_model=list[AnnouncementOut], dependencies=[Depends(get_current_user)])
def list_announcements(db: Session = Depends(get_db)):
    """Pinned announcements first, then newest first — this is the student dashboard feed."""
    return db.query(Announcement).order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).all()


@router.post("/admin/announcements", response_model=AnnouncementOut, status_code=201, dependencies=[Depends(require_admin)])
def create_announcement(payload: AnnouncementCreate, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    announcement = Announcement(created_by_id=current_user.id, **payload.model_dump())
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.put("/admin/announcements/{announcement_id}", response_model=AnnouncementOut, dependencies=[Depends(require_admin)])
def update_announcement(announcement_id: uuid.UUID, payload: AnnouncementUpdate, db: Session = Depends(get_db)):
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, field, value)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/admin/announcements/{announcement_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_announcement(announcement_id: uuid.UUID, db: Session = Depends(get_db)):
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()
