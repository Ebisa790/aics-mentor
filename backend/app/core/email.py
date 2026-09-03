import logging
import smtplib
import requests
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_email_background(to_email, subject, body_text, body_html):
    """Send email in background thread."""
    try:
        send_email(to_email, subject, body_text, body_html)
    except Exception as e:
        logger.error(f"Background email failed: {e}")


def send_email_async(to_email, subject, body_text, body_html=None):
    """Non-blocking email sending."""
    thread = threading.Thread(
        target=_send_email_background,
        args=(to_email, subject, body_text, body_html),
        daemon=True
    )
    thread.start()


def send_email(
    to_email: str, 
    subject: str, 
    body_text: str, 
    body_html: str | None = None
) -> bool:
    """
    Core SMTP helper for sending transactional emails.
    
    Returns True if sent or safely logged, False if delivery failed.
    """
    if not settings.SMTP_HOST:
        # Local development fallback when SMTP is unconfigured
        logger.warning(
            "SMTP not configured — Email to %s suppressed.\nSubject: %s\nBody:\n%s",
            to_email,
            subject,
            body_text,
        )
        return True

    # Build MIME message (Multipart if HTML is present)
    if body_html:
        message = MIMEMultipart("alternative")
        message.attach(MIMEText(body_text, "plain", "utf-8"))
        message.attach(MIMEText(body_html, "html", "utf-8"))
    else:
        message = MIMEText(body_text, "plain", "utf-8")

    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email

    try:
        # Handle Port 465 (Implicit SSL) vs 587/25 (Explicit STARTTLS)
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=60) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=60) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())

        logger.info("Email successfully sent to %s with subject '%s'", to_email, subject)
        return True

    except smtplib.SMTPException as e:
        logger.error("Failed to send email to %s via SMTP: %s", to_email, str(e), exc_info=True)
        return False
    except Exception as e:
        logger.error("Unexpected error occurred while sending email to %s: %s", to_email, str(e), exc_info=True)
        return False


def send_welcome_email(to_email: str, full_name: str) -> bool:
    """
    Sends a welcome email to newly registered users.
    """
    subject = "Welcome to ExitAI"

    body_text = (
        f"Hi {full_name},\n\n"
        "Welcome to ExitAI You're now ready to start preparing for the Ethiopian CS Exit Exam.\n\n"
        "What you can do:\n"
        "- Take practice quizzes (1 per 3 hours for free)\n"
        "- Preview course notes (20% free)\n"
        "- Upgrade to Premium for full access\n\n"
        "Premium includes:\n"
        "- Unlimited quizzes\n"
        "- 100-question Mock Exam Simulator\n"
        "- Full access to all 16 CS course notes\n"
        "- AI Tutor & personalized explanations\n\n"
        "Start studying\n\n"
        "Best regards,\n"
        "ExitAI Ethiopia Team"
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .header h2 {{ color: #4f46e5; margin: 0; }}
            .features {{ background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; }}
            .features li {{ margin: 8px 0; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h2>Welcome to ExitAI 🎉</h2>
            </div>
            <p>Hi <strong>{full_name}</strong>,</p>
            <p>Welcome to <strong>ExitAI Ethiopia</strong>! You're now ready to start preparing for the Ethiopian CS Exit Exam.</p>
            <p>What you can do:</p>
            <div class="features">
                <ul>
                    <li>📝 Take practice quizzes (1 per 3 hours free)</li>
                    <li>📚 Preview course notes (20% free)</li>
                    <li>💎 Upgrade to Premium for full access</li>
                </ul>
            </div>
            <p><strong>Premium includes:</strong></p>
            <div class="features">
                <ul>
                    <li>✅ Unlimited quizzes</li>
                    <li>🎯 100-question Mock Exam Simulator</li>
                    <li>📖 Full access to all 16 CS course notes</li>
                    <li>🤖 AI Tutor & personalized explanations</li>
                </ul>
            </div>
            <p style="text-align: center;"><a href="http://localhost:5173/courses" class="cta">Start Preparing</a></p>
            <p>Best regards,<br>ExitAI Ethiopia Team</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)


def send_payment_confirmation_email(to_email: str, full_name: str, amount: float, currency: str, plan_name: str) -> bool:
    """
    Sends payment confirmation email after successful purchase.
    """
    subject = "Payment received"

    body_text = (
        f"Hi {full_name},\n\n"
        f"Your payment of {amount} {currency} for {plan_name} has been confirmed.\n\n"
        "Your premium access is now active\n\n"
        "You now have access to:\n"
        "- Unlimited quizzes (no cooldown)\n"
        "- 100-question Mock Exam Simulator\n"
        "- Full access to all 16 CS course notes\n"
        "- AI Tutor & explanations\n"
        "- Advanced analytics\n\n"
        "Start exploring your full access now!\n\n"
        "Thank you for supporting ExitAI Ethiopia.\n\n"
        "Best regards,\n"
        "ExitAI Ethiopia Team"
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }}
            .success {{ font-size: 48px; margin: 16px 0; }}
            h2 {{ color: #059669; }}
            .details {{ background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="success">✅</div>
            <h2>Payment Confirmed!</h2>
            <p>Hi <strong>{full_name}</strong>,</p>
            <p>Your payment of <strong>{amount} {currency}</strong> for <strong>{plan_name}</strong> has been confirmed.</p>
            <div class="details">
                <p><strong>Your premium access is now active</strong></p>
            </div>
            <p><a href="http://localhost:5173/dashboard" class="cta">Go to Dashboard</a></p>
            <p>Thank you for supporting ExitAI Ethiopia.</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """
    Sends a styled password reset email containing a reset link.
    """
    subject = "Reset your ExitAI Ethiopia password"

    body_text = (
        "Someone requested a password reset for your ExitAI Ethiopia account.\n\n"
        f"Reset your password by visiting this link:\n{reset_link}\n\n"
        "This link expires in 30 minutes. If you did not request this, you can safely ignore this email."
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; }}
            .btn {{ display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }}
            .footer {{ font-size: 13px; color: #6b7280; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Reset Your Password</h2>
            <p>Someone requested a password reset for your <strong>ExitAI Ethiopia</strong> account.</p>
            <p>Click the button below to set a new password:</p>
            <p><a href="{reset_link}" class="btn" target="_blank">Reset Password</a></p>
            <p style="font-size: 14px; color: #4b5563;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 13px; word-break: break-all;"><a href="{reset_link}">{reset_link}</a></p>
            <p class="footer">This link expires in 30 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)


def send_support_ticket_confirmation(to_email: str, ticket_id: str, ticket_subject: str) -> bool:
    """
    Sends confirmation email when a support ticket is created.
    """
    subject = f"Ticket received - #{ticket_id[:8]}"

    body_text = (
        f"Hello,\n\n"
        f"Your support ticket has been received.\n\n"
        f"Ticket ID: {ticket_id}\n"
        f"Subject: {ticket_subject}\n\n"
        f"Our support team will review your ticket and respond within 1-2 business days.\n\n"
        f"Best regards,\n"
        f"ExitAI Ethiopia Support Team"
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .header h2 {{ color: #4f46e5; margin: 0; }}
            .ticket-info {{ background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h2>Ticket received</h2>
            </div>
            <p>Hello,</p>
            <p>Your support ticket has been received.</p>
            <div class="ticket-info">
                <p><strong>Ticket ID:</strong> {ticket_id}</p>
                <p><strong>Subject:</strong> {ticket_subject}</p>
            </div>
            <p>Our support team will review your ticket and respond within 1-2 business days.</p>
            <p>Best regards,<br>ExitAI Ethiopia Support Team</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)


def send_support_ticket_response(to_email: str, ticket_id: str, admin_response: str) -> bool:
    """
    Sends email when admin responds to a support ticket.
    """
    subject = f"Ticket update - #{ticket_id[:8]}"

    body_text = (
        f"Hello,\n\n"
        f"Your support ticket has been updated.\n\n"
        f"Ticket ID: {ticket_id}\n"
        f"Admin Response:\n{admin_response}\n\n"
        f"Best regards,\n"
        f"ExitAI Ethiopia Support Team"
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; }}
            .response {{ background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #059669; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Ticket update</h2>
            <p>Hello,</p>
            <p>Your support ticket has been updated.</p>
            <p><strong>Ticket ID:</strong> {ticket_id}</p>
            <div class="response">
                <p><strong>Admin Response:</strong></p>
                <p>{admin_response}</p>
            </div>
            <p>Best regards,<br>ExitAI Ethiopia Support Team</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)


def send_support_ticket_resolved(to_email: str, ticket_id: str) -> bool:
    """
    Sends email when a support ticket is resolved.
    """
    subject = f"Ticket resolved - #{ticket_id[:8]}"

    body_text = (
        f"Hello,\n\n"
        f"Your support ticket has been resolved.\n\n"
        f"Ticket ID: {ticket_id}\n\n"
        f"If you need further assistance, please submit a new ticket.\n\n"
        f"Best regards,\n"
        f"ExitAI Ethiopia Support Team"
    )

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px; }}
            .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; }}
            .success {{ font-size: 48px; margin: 16px 0; }}
            h2 {{ color: #059669; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="success">✅</div>
            <h2>Ticket Resolved</h2>
            <p>Hello,</p>
            <p>Your support ticket has been resolved.</p>
            <p><strong>Ticket ID:</strong> {ticket_id}</p>
            <p>If you need further assistance, please submit a new ticket.</p>
            <p>Best regards,<br>ExitAI Ethiopia Support Team</p>
        </div>
    </body>
    </html>
    """

    return send_email(to_email=to_email, subject=subject, body_text=body_text, body_html=body_html)