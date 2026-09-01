from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

# Value mappings (UPPERCASE local → lowercase Supabase)
value_maps = {
    'question_type': {
        'MULTIPLE_CHOICE': 'multiple_choice',
        'TRUE_FALSE': 'true_false',
        'SHORT_ANSWER': 'short_answer',
        'CODE_TRACE': 'code_trace',
    },
    'difficulty': {
        'BEGINNER': 'beginner',
        'INTERMEDIATE': 'intermediate',
        'ADVANCED': 'advanced',
        'EASY': 'easy',
        'MEDIUM': 'medium',
        'HARD': 'hard',
    },
    'quiz_type': {
        'DAILY_QUIZ': 'daily_quiz',
        'FULL_SIMULATION': 'full_simulation',
        'CHAPTER_TEST': 'chapter_test',
        'WEEKLY_EXAM': 'weekly_exam',
    },
    'role': {
        'STUDENT': 'student',
        'ADMIN': 'admin',
    },
    'subscription_tier': {
        'FREE': 'free',
        'PREMIUM': 'premium',
    },
    'generated_mode': {
        'PRACTICE': 'practice',
        'MOCK': 'mock',
    },
    'review_status': {
        'GENERATED': 'generated',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'ARCHIVED': 'archived',
        'UNDER_REVIEW': 'under_review',
    },
    'status': {
        'ACTIVE': 'active',
        'EXPIRED': 'expired',
        'CANCELLED': 'cancelled',
        'PENDING': 'pending',
        'SUCCESS': 'success',
        'FAILED': 'failed',
        'IN_PROGRESS': 'in_progress',
        'SUBMITTED': 'submitted',
        'GRADED': 'graded',
        'OPEN': 'open',
        'RESOLVED': 'resolved',
        'CLOSED': 'closed',
    },
    'priority': {
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high',
        'URGENT': 'urgent',
    },
    'duration_type': {
        'LIFETIME': 'lifetime',
        'MONTHLY': 'monthly',
        'SEMESTER': 'semester',
        'ANNUAL': 'annual',
        'CUSTOM': 'custom',
    },
}

def apply_mapping(col, val):
    """Apply value mapping if exists"""
    if val is None:
        return None
    if col in value_maps:
        return value_maps[col].get(val, val)
    return val

def migrate_table(table_name, exclude_cols=None):
    print(f'\nMigrating {table_name}...')
    
    # Get column names
    with local_engine.connect() as conn:
        result = conn.execute(text(f'''
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        '''))
        all_columns = [row[0] for row in result]
    
    # Exclude columns if needed
    columns = [c for c in all_columns if not (exclude_cols and c in exclude_cols)]
    
    # Get data
    with local_engine.connect() as conn:
        result = conn.execute(text(f'SELECT * FROM {table_name}'))
        rows = result.fetchall()
    
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
                val = apply_mapping(col, val)
                # Handle JSON columns
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

# Run migrations
print('=== SAFE DATA MIGRATION ===')
migrate_table('users')
migrate_table('questions')
migrate_table('flashcards')
migrate_table('quizzes')
migrate_table('quiz_questions')
migrate_table('exam_questions')
migrate_table('code_trace_drills')
migrate_table('support_tickets')

print('\n=== MIGRATION COMPLETE ===')
