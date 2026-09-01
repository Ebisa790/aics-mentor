from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

def migrate_table(table_name, value_mapping=None):
    print(f'\nMigrating {table_name}...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text(f'SELECT * FROM {table_name}'))
        rows = result.fetchall()
        columns = list(result.keys())
    
    total = len(rows)
    print(f'  Found {total} rows')
    
    if total == 0:
        print(f'  ✅ No data')
        return
    
    migrated = 0
    for row in rows:
        try:
            values = {}
            for col in columns:
                val = getattr(row, col)
                if value_mapping and col in value_mapping:
                    val = value_mapping[col].get(val, val)
                if isinstance(val, dict):
                    val = json.dumps(val)
                values[col] = val
            
            placeholders = ', '.join([f':{col}' for col in columns])
            col_list = ', '.join(columns)
            insert_sql = f'INSERT INTO {table_name} ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
            
            with supabase_engine.connect() as conn:
                conn.execute(text(insert_sql), values)
                conn.commit()
            migrated += 1
        except Exception as e:
            if migrated == 0:
                print(f'  First error: {str(e)[:200]}')
    
    print(f'  ✅ {migrated}/{total} migrated')

print('=== MIGRATING DATA TO SUPABASE ===')

migrate_table('users', {
    'role': {'STUDENT': 'student', 'ADMIN': 'admin'},
    'subscription_tier': {'FREE': 'free', 'PREMIUM': 'premium'},
})

migrate_table('questions', {
    'question_type': {'MULTIPLE_CHOICE': 'multiple_choice', 'SHORT_ANSWER': 'short_answer'},
    'difficulty': {'BEGINNER': 'beginner', 'INTERMEDIATE': 'intermediate', 'ADVANCED': 'advanced'},
})

migrate_table('flashcards')
migrate_table('quizzes', {
    'quiz_type': {'DAILY_QUIZ': 'daily_quiz', 'FULL_SIMULATION': 'full_simulation', 'CHAPTER_TEST': 'chapter_test', 'WEEKLY_EXAM': 'weekly_exam'},
})
migrate_table('quiz_questions')
migrate_table('exam_questions', {
    'difficulty': {'EASY': 'easy', 'MEDIUM': 'medium', 'HARD': 'hard'},
    'review_status': {'GENERATED': 'generated', 'APPROVED': 'approved', 'REJECTED': 'rejected', 'ARCHIVED': 'archived', 'UNDER_REVIEW': 'under_review'},
})
migrate_table('code_trace_drills')
migrate_table('support_tickets', {
    'status': {'OPEN': 'open', 'IN_PROGRESS': 'in_progress', 'RESOLVED': 'resolved', 'CLOSED': 'closed'},
    'priority': {'LOW': 'low', 'MEDIUM': 'medium', 'HIGH': 'high', 'URGENT': 'urgent'},
})

print('\n=== MIGRATION COMPLETE ===')
