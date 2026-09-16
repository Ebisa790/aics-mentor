"""
Support Ticket Routes
Handles user support ticket submissions and management.
"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.telegram import notify_new_support_ticket
from app.models.user import User, UserRole
from app.models.support_ticket import SupportTicket, TicketStatus, TicketPriority
from app.api.deps import get_current_user, get_current_user_optional, require_admin
from app.schemas.support import SupportTicketCreate, SupportIssueType
from app.core.email import (
    send_support_ticket_confirmation,
    send_support_ticket_response,
    send_support_ticket_resolved,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/support", tags=["support"])


@router.post("/tickets")
@limiter.limit("5/hour;15/day")
def create_support_ticket(
    request: Request,
    payload: SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Create a support ticket.

    - Authenticated users: email is taken from their account (client email ignored).
    - Anonymous users: email is required and used as the contact address.
    - Rate limited to prevent abuse.
    - Sends a confirmation email to the submitter.
    - Sends a Telegram ping to the admin team.
    """
    # ── Determine the contact email ──────────────────────────────
    if current_user:
        # Trust the authenticated user's email — ignore client input
        email_to_use = current_user.email
        user_id = current_user.id
    else:
        if not payload.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for anonymous submissions",
            )
        email_to_use = str(payload.email)

        # Try to link to an existing user first
        existing_user = (
            db.query(User).filter(User.email == email_to_use).first()
        )
        if existing_user:
            user_id = existing_user.id
        else:
            # The DB requires a user_id, so create a minimal placeholder.
            # is_active=False prevents anyone from logging in with this email.
            import hashlib as _hashlib
            temp_user = User(
                email=email_to_use,
                hashed_password=_hashlib.sha256(email_to_use.encode()).hexdigest(),
                full_name=email_to_use.split("@")[0],
                role=UserRole.STUDENT,
                is_active=False,
            )
            db.add(temp_user)
            db.commit()
            db.refresh(temp_user)
            user_id = temp_user.id

    # ── Create the ticket ────────────────────────────────────────
    ticket = SupportTicket(
        user_id=user_id,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        issue_type=payload.issue_type.value,
        status=TicketStatus.OPEN,
        priority=TicketPriority.MEDIUM,
        created_at=datetime.utcnow(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    logger.info(
        f"Support ticket created: id={ticket.id}, "
        f"email={email_to_use}, type={payload.issue_type.value}"
    )

    # ── Confirmation email to submitter ──────────────────────────
    try:
        send_support_ticket_confirmation(
            to_email=email_to_use,
            ticket_id=str(ticket.id),
            ticket_subject=payload.subject.strip(),
        )
    except Exception as e:
        logger.warning(f"Support confirmation email failed: {e}")

    # ── Telegram ping to admin ───────────────────────────────────
    try:
        notify_new_support_ticket(
            ticket_id=str(ticket.id),
            email=email_to_use,
            issue_type=payload.issue_type.value,
            subject=payload.subject.strip(),
            message_preview=payload.message.strip()[:200],
        )
    except Exception as e:
        logger.warning(f"Support Telegram notify failed: {e}")

    return {
        "message": "Support ticket created successfully",
        "ticket_id": str(ticket.id),
        "status": ticket.status.value,
        "created_at": ticket.created_at.isoformat(),
    }


@router.get("/tickets")
def list_user_tickets(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    List support tickets for the current user.
    """
    if not current_user:
        return {"tickets": []}
    
    tickets = db.query(SupportTicket).filter(
        SupportTicket.user_id == current_user.id
    ).order_by(SupportTicket.created_at.desc()).all()
    
    return {
        "tickets": [
            {
                "id": str(t.id),
                "subject": t.subject,
                "message": t.message,
                "issue_type": t.issue_type,
                "status": t.status.value,
                "admin_response": t.admin_response,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat() if t.updated_at else None
            }
            for t in tickets
        ]
    }


@router.get("/tickets/{ticket_id}")
def get_ticket_details(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Get details of a specific ticket.
    """
    if not current_user:
        raise HTTPException(401, "Authentication required")
    
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == uuid.UUID(ticket_id)
    ).first()
    
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    # Check if user owns this ticket or is admin
    if ticket.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Access denied")
    
    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "message": ticket.message,
        "issue_type": ticket.issue_type,
        "status": ticket.status.value,
        "admin_response": ticket.admin_response,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None
    }


# ===== ADMIN ENDPOINTS =====

@router.get("/admin/tickets")
def list_all_tickets(
    status: str | None = Query(None, description="Filter by status"),
    issue_type: str | None = Query(None, description="Filter by issue type"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    List all support tickets (admin only).
    """
    query = db.query(SupportTicket)
    
    if status:
        # Convert string to enum for filtering
        try:
            status_enum = TicketStatus(status)
            query = query.filter(SupportTicket.status == status_enum)
        except ValueError:
            return {"tickets": []}
    
    if issue_type:
        query = query.filter(SupportTicket.issue_type == issue_type)
    
    tickets = query.order_by(SupportTicket.created_at.desc()).limit(limit).all()
    
    return {
        "tickets": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id) if t.user_id else None,
                "user_email": t.user.email if t.user else "Unknown",
                "subject": t.subject,
                "message": t.message,
                "issue_type": t.issue_type,
                "status": t.status.value,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat() if t.updated_at else None
            }
            for t in tickets
        ]
    }


@router.get("/admin/tickets/stats")
def get_ticket_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Get ticket statistics (admin only).
    """
    total = db.query(SupportTicket).count()
    open_count = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.OPEN).count()
    in_progress = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.IN_PROGRESS).count()
    resolved = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.RESOLVED).count()
    closed = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.CLOSED).count()
    
    return {
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved,
        "closed": closed
    }


@router.put("/admin/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update ticket status (admin only).
    """
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == uuid.UUID(ticket_id)
    ).first()
    
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    new_status = payload.get("status")
    response = payload.get("response")
    
    if new_status:
        try:
            # Convert string to enum
            ticket.status = TicketStatus(new_status)
        except ValueError:
            raise HTTPException(400, f"Invalid status. Must be one of: open, in_progress, resolved, closed")
    
    if response:
        ticket.admin_response = response
        ticket.handled_by_id = current_user.id
    
    if ticket.status == TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.utcnow()
    
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    
    # Send email notifications
    if ticket.user and ticket.user.email:
        try:
            # Send response email if admin provided a response
            if response:
                send_support_ticket_response(
                    to_email=ticket.user.email,
                    ticket_id=str(ticket.id),
                    admin_response=response
                )
            
            # Send resolved email if status changed to resolved
            if new_status == "resolved" or ticket.status == TicketStatus.RESOLVED:
                send_support_ticket_resolved(
                    to_email=ticket.user.email,
                    ticket_id=str(ticket.id)
                )
        except Exception as e:
            # Don't fail status update if email fails
            print(f"Failed to send notification email: {e}")
    
    return {
        "message": "Ticket updated successfully",
        "ticket_id": str(ticket.id),
        "status": ticket.status.value
    }