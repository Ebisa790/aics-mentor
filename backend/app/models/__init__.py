from app.models.user import User, UserRole, SubscriptionTier
from app.models.support_ticket import SupportTicket, TicketStatus, TicketPriority  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.announcement import Announcement, AnnouncementType  # noqa: F401
from app.models.password_reset import PasswordResetToken  # noqa: F401
from app.models.course import Course, Topic  # noqa: F401
from app.models.material import LearningMaterial, MaterialSource, MaterialStatus  # noqa: F401
from app.models.course_material import CourseMaterial, MaterialContentType  # noqa: F401
from app.models.exam_question import ExamQuestion, ExamDifficulty, ReviewStatus  # noqa: F401
from app.models.quiz import Question, QuestionType, DifficultyLevel, Quiz, QuizType, QuizQuestion, GeneratedExamMode  # noqa: F401
from app.models.attempt import Attempt, AttemptStatus, AttemptAnswer  # noqa: F401
from app.models.conversation import AIConversation, AIMessage, MessageRole, TutorMode  # noqa: F401
from app.models.code_trace_drill import CodeTraceDrill  # noqa: F401
from app.models.flashcard import Flashcard  # noqa: F401
from app.models.payment import Payment, PaymentStatus, PricingPlan, Subscription, PlanDurationType, SubscriptionStatus  # noqa: F401
from app.models.attempt import DrillAttempt  # noqa: F401

from app.core.database import Base