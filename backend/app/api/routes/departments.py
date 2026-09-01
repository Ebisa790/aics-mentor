from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.department import Department
from app.schemas.course import DepartmentCreate, DepartmentOut

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut], dependencies=[Depends(get_current_user)])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).filter(Department.is_active.is_(True)).order_by(Department.name).all()


@router.post("", response_model=DepartmentOut, dependencies=[Depends(require_admin)])
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    department = Department(**payload.model_dump())
    db.add(department)
    db.commit()
    db.refresh(department)
    return department
