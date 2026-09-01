"""initial schema sync

Revision ID: 2ae7e418c1a9
Revises: 3a76ca287e25
Create Date: 2026-08-13 00:50:10.898400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '2ae7e418c1a9'
down_revision: Union[str, None] = '3a76ca287e25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. ai_messages
    op.alter_column('ai_messages', 'role',
               existing_type=postgresql.ENUM('USER', 'ASSISTANT', name='messagerole'),
               type_=sa.Enum('USER', 'ASSISTANT', name='message_role'),
               postgresql_using='role::text::message_role',
               existing_nullable=False)
    op.alter_column('ai_messages', 'mode',
               existing_type=postgresql.ENUM('BEGINNER', 'ADVANCED', 'EXPLANATION', name='tutormode'),
               type_=sa.Enum('BEGINNER', 'ADVANCED', 'EXPLANATION', name='tutor_mode'),
               postgresql_using='mode::text::tutor_mode',
               existing_nullable=False)

    # 2. announcements
    op.alter_column('announcements', 'announcement_type',
               existing_type=postgresql.ENUM('MOE_UPDATE', 'EXAM_NOTICE', 'PLATFORM_NEWS', name='announcementtype'),
               type_=sa.Enum('MOE_UPDATE', 'EXAM_NOTICE', 'PLATFORM_NEWS', name='announcement_type'),
               postgresql_using='announcement_type::text::announcement_type',
               existing_nullable=False)

    # 3. attempts
    op.alter_column('attempts', 'status',
               existing_type=postgresql.ENUM('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attemptstatus'),
               type_=sa.Enum('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attempt_status'),
               postgresql_using='status::text::attempt_status',
               existing_nullable=False)

    # 4. course_materials
    op.alter_column('course_materials', 'material_type',
               existing_type=postgresql.ENUM('NOTE', 'SUMMARY', 'SLIDE_DECK', name='materialcontenttype'),
               type_=sa.Enum('NOTE', 'SUMMARY', 'SLIDE_DECK', name='material_content_type'),
               postgresql_using='material_type::text::material_content_type',
               existing_nullable=False)

    # 5. drill_attempts (VARCHAR to UUID cast)
    op.alter_column('drill_attempts', 'drill_id',
               existing_type=sa.VARCHAR(),
               type_=sa.Uuid(),
               postgresql_using='drill_id::uuid',
               existing_nullable=True)

    # 6. exam_questions
    op.alter_column('exam_questions', 'difficulty',
               existing_type=postgresql.ENUM('EASY', 'MEDIUM', 'HARD', name='examdifficulty'),
               type_=sa.Enum('EASY', 'MEDIUM', 'HARD', name='exam_difficulty'),
               postgresql_using='difficulty::text::exam_difficulty',
               existing_nullable=False)
    op.alter_column('exam_questions', 'review_status',
               existing_type=postgresql.ENUM('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', name='reviewstatus'),
               type_=sa.Enum('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', name='review_status'),
               postgresql_using='review_status::text::review_status',
               existing_nullable=False)

    # 7. learning_materials
    op.alter_column('learning_materials', 'source',
               existing_type=postgresql.ENUM('ADMIN_OFFICIAL', 'STUDENT_PERSONAL', name='materialsource'),
               type_=sa.Enum('ADMIN_OFFICIAL', 'STUDENT_PERSONAL', name='material_source'),
               postgresql_using='source::text::material_source',
               existing_nullable=False)
    op.alter_column('learning_materials', 'status',
               existing_type=postgresql.ENUM('UPLOADED', 'PROCESSING', 'EMBEDDED', 'FAILED', name='materialstatus'),
               type_=sa.Enum('UPLOADED', 'PROCESSING', 'EMBEDDED', 'FAILED', name='material_status'),
               postgresql_using='status::text::material_status',
               existing_nullable=False)

    # 8. questions
    op.alter_column('questions', 'question_type',
               existing_type=postgresql.ENUM('MULTIPLE_CHOICE', 'SHORT_ANSWER', name='questiontype'),
               type_=sa.Enum('MULTIPLE_CHOICE', 'SHORT_ANSWER', name='question_type'),
               postgresql_using='question_type::text::question_type',
               existing_nullable=False)
    op.alter_column('questions', 'difficulty',
               existing_type=postgresql.ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', name='difficultylevel'),
               type_=sa.Enum('BEGINNER', 'INTERMEDIATE', 'ADVANCED', name='difficulty_level'),
               postgresql_using='difficulty::text::difficulty_level',
               existing_nullable=False)

    # 9. quizzes
    op.alter_column('quizzes', 'quiz_type',
               existing_type=postgresql.ENUM('DAILY_QUIZ', 'CHAPTER_TEST', 'WEEKLY_EXAM', 'FULL_SIMULATION', name='quiztype'),
               type_=sa.Enum('DAILY_QUIZ', 'CHAPTER_TEST', 'WEEKLY_EXAM', 'FULL_SIMULATION', name='quiz_type'),
               postgresql_using='quiz_type::text::quiz_type',
               existing_nullable=False)
    op.alter_column('quizzes', 'generated_mode',
               existing_type=postgresql.ENUM('PRACTICE', 'MOCK', name='generatedexammode'),
               type_=sa.Enum('PRACTICE', 'MOCK', name='generated_exam_mode'),
               postgresql_using='generated_mode::text::generated_exam_mode',
               existing_nullable=False)

    # 10. users
    op.alter_column('users', 'role',
               existing_type=postgresql.ENUM('STUDENT', 'ADMIN', name='userrole'),
               type_=sa.Enum('student', 'admin', name='user_role'),
               postgresql_using='role::text::user_role',
               existing_nullable=False)
    op.alter_column('users', 'subscription_tier',
               existing_type=postgresql.ENUM('FREE', 'PREMIUM', name='subscriptiontier'),
               type_=sa.Enum('free', 'premium', name='subscription_tier'),
               postgresql_using='subscription_tier::text::subscription_tier',
               existing_nullable=False)


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_users_subscription_tier'), table_name='users')
    op.drop_index(op.f('ix_users_role'), table_name='users')
    op.drop_index(op.f('ix_users_is_active'), table_name='users')
    op.alter_column('users', 'subscription_tier',
               existing_type=sa.Enum('free', 'premium', name='subscription_tier'),
               type_=postgresql.ENUM('FREE', 'PREMIUM', name='subscriptiontier'),
               existing_nullable=False)
    op.alter_column('users', 'failed_login_attempts',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('users', 'role',
               existing_type=sa.Enum('student', 'admin', name='user_role'),
               type_=postgresql.ENUM('STUDENT', 'ADMIN', name='userrole'),
               existing_nullable=False)
    op.drop_column('users', 'subscription_expires_at')
    op.drop_index(op.f('ix_user_devices_session_jti'), table_name='user_devices')
    op.create_index('ix_user_devices_session_jti', 'user_devices', ['session_jti'], unique=False)
    op.create_index('ix_user_devices_user_id', 'user_devices', ['user_id'], unique=False)
    op.alter_column('user_devices', 'last_active',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False)
    op.drop_index('ix_topics_course_order', table_name='topics')
    op.drop_index(op.f('ix_topics_course_id'), table_name='topics')
    op.drop_index(op.f('ix_quizzes_generated_for_user_id'), table_name='quizzes')
    op.drop_index(op.f('ix_quizzes_course_id'), table_name='quizzes')
    op.alter_column('quizzes', 'generated_mode',
               existing_type=sa.Enum('PRACTICE', 'MOCK', name='generated_exam_mode'),
               type_=postgresql.ENUM('PRACTICE', 'MOCK', name='generatedexammode'),
               existing_nullable=True)
    op.alter_column('quizzes', 'quiz_type',
               existing_type=sa.Enum('DAILY_QUIZ', 'CHAPTER_TEST', 'WEEKLY_EXAM', 'FULL_SIMULATION', name='quiz_type'),
               type_=postgresql.ENUM('DAILY_QUIZ', 'CHAPTER_TEST', 'WEEKLY_EXAM', 'FULL_SIMULATION', name='quiztype'),
               existing_nullable=False)
    op.drop_index('ix_quiz_questions_quiz_order', table_name='quiz_questions')
    op.drop_index(op.f('ix_quiz_questions_quiz_id'), table_name='quiz_questions')
    op.drop_index(op.f('ix_quiz_questions_question_id'), table_name='quiz_questions')
    op.drop_index(op.f('ix_questions_topic_id'), table_name='questions')
    op.drop_index(op.f('ix_questions_course_id'), table_name='questions')
    op.drop_index('ix_questions_course_difficulty', table_name='questions')
    op.alter_column('questions', 'difficulty',
               existing_type=sa.Enum('BEGINNER', 'INTERMEDIATE', 'ADVANCED', name='difficulty_level'),
               type_=postgresql.ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', name='difficultylevel'),
               existing_nullable=False)
    op.alter_column('questions', 'question_type',
               existing_type=sa.Enum('MULTIPLE_CHOICE', 'SHORT_ANSWER', name='question_type'),
               type_=postgresql.ENUM('MULTIPLE_CHOICE', 'SHORT_ANSWER', name='questiontype'),
               existing_nullable=False)
    op.drop_index(op.f('ix_password_reset_tokens_user_id'), table_name='password_reset_tokens')
    op.drop_index(op.f('ix_learning_materials_uploaded_by_id'), table_name='learning_materials')
    op.drop_index(op.f('ix_learning_materials_topic_id'), table_name='learning_materials')
    op.drop_index('ix_learning_materials_status_public', table_name='learning_materials')
    op.drop_index(op.f('ix_learning_materials_status'), table_name='learning_materials')
    op.drop_index(op.f('ix_learning_materials_is_public'), table_name='learning_materials')
    op.drop_index(op.f('ix_learning_materials_course_id'), table_name='learning_materials')
    op.alter_column('learning_materials', 'status',
               existing_type=sa.Enum('UPLOADED', 'PROCESSING', 'EMBEDDED', 'FAILED', name='material_status'),
               type_=postgresql.ENUM('UPLOADED', 'PROCESSING', 'EMBEDDED', 'FAILED', name='materialstatus'),
               existing_nullable=False)
    op.alter_column('learning_materials', 'source',
               existing_type=sa.Enum('ADMIN_OFFICIAL', 'STUDENT_PERSONAL', name='material_source'),
               type_=postgresql.ENUM('ADMIN_OFFICIAL', 'STUDENT_PERSONAL', name='materialsource'),
               existing_nullable=False)
    op.drop_index('ix_exam_questions_status_course', table_name='exam_questions')
    op.drop_index(op.f('ix_exam_questions_reviewed_by_id'), table_name='exam_questions')
    op.drop_index(op.f('ix_exam_questions_review_status'), table_name='exam_questions')
    op.drop_index(op.f('ix_exam_questions_is_ai_generated'), table_name='exam_questions')
    op.drop_index(op.f('ix_exam_questions_created_by_id'), table_name='exam_questions')
    op.drop_index(op.f('ix_exam_questions_course_id'), table_name='exam_questions')
    op.alter_column('exam_questions', 'review_status',
               existing_type=sa.Enum('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', name='review_status'),
               type_=postgresql.ENUM('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', name='reviewstatus'),
               existing_nullable=False)
    op.alter_column('exam_questions', 'difficulty',
               existing_type=sa.Enum('EASY', 'MEDIUM', 'HARD', name='exam_difficulty'),
               type_=postgresql.ENUM('EASY', 'MEDIUM', 'HARD', name='examdifficulty'),
               existing_nullable=False)
    op.drop_index(op.f('ix_drill_attempts_drill_id'), table_name='drill_attempts')
    op.alter_column('drill_attempts', 'drill_id',
               existing_type=sa.Uuid(),
               type_=sa.VARCHAR(),
               existing_nullable=True)
    op.drop_index(op.f('ix_departments_short_name'), table_name='departments')
    op.drop_index(op.f('ix_departments_is_active'), table_name='departments')
    op.drop_index('ix_courses_dept_order', table_name='courses')
    op.drop_index(op.f('ix_courses_department_id'), table_name='courses')
    op.drop_index(op.f('ix_courses_code'), table_name='courses')
    op.drop_index(op.f('ix_courses_category'), table_name='courses')
    op.drop_index(op.f('ix_course_materials_course_id'), table_name='course_materials')
    op.alter_column('course_materials', 'material_type',
               existing_type=sa.Enum('NOTE', 'SUMMARY', 'SLIDE_DECK', name='material_content_type'),
               type_=postgresql.ENUM('NOTE', 'SUMMARY', 'SLIDE_DECK', name='materialcontenttype'),
               existing_nullable=False)
    op.drop_index('ix_attempts_student_quiz', table_name='attempts')
    op.drop_index(op.f('ix_attempts_student_id'), table_name='attempts')
    op.drop_index(op.f('ix_attempts_quiz_id'), table_name='attempts')
    op.alter_column('attempts', 'status',
               existing_type=sa.Enum('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attempt_status'),
               type_=postgresql.ENUM('IN_PROGRESS', 'SUBMITTED', 'GRADED', name='attemptstatus'),
               existing_nullable=False)
    op.drop_index(op.f('ix_attempt_answers_question_id'), table_name='attempt_answers')
    op.drop_index(op.f('ix_attempt_answers_attempt_id'), table_name='attempt_answers')
    op.drop_index('ix_announcements_pinned_created', table_name='announcements')
    op.drop_index(op.f('ix_announcements_is_pinned'), table_name='announcements')
    op.alter_column('announcements', 'announcement_type',
               existing_type=sa.Enum('MOE_UPDATE', 'EXAM_NOTICE', 'PLATFORM_NEWS', name='announcement_type'),
               type_=postgresql.ENUM('MOE_UPDATE', 'EXAM_NOTICE', 'PLATFORM_NEWS', name='announcementtype'),
               existing_nullable=False)
    op.drop_index(op.f('ix_ai_messages_flagged_topic'), table_name='ai_messages')
    op.drop_index(op.f('ix_ai_messages_conversation_id'), table_name='ai_messages')
    op.drop_index('ix_ai_messages_conversation_created', table_name='ai_messages')
    op.alter_column('ai_messages', 'mode',
               existing_type=sa.Enum('BEGINNER', 'ADVANCED', 'EXPLANATION', name='tutor_mode'),
               type_=postgresql.ENUM('BEGINNER', 'ADVANCED', 'EXPLANATION', name='tutormode'),
               existing_nullable=True)
    op.alter_column('ai_messages', 'role',
               existing_type=sa.Enum('USER', 'ASSISTANT', name='message_role'),
               type_=postgresql.ENUM('USER', 'ASSISTANT', name='messagerole'),
               existing_nullable=False)
    op.drop_index(op.f('ix_ai_conversations_student_id'), table_name='ai_conversations')
    op.drop_index(op.f('ix_ai_conversations_course_id'), table_name='ai_conversations')
    op.create_table('student_progress',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('student_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('course_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('quizzes_taken', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('average_score_percent', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('mastery_percent', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('last_activity_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='student_progress_course_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['users.id'], name='student_progress_student_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='student_progress_pkey'),
    sa.UniqueConstraint('student_id', 'course_id', name='uq_student_course_progress')
    )
    # ### end Alembic commands ###
