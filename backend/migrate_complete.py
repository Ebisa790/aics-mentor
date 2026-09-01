from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

# Value mappings
question_type_map = {
    'MULTIPLE_CHOICE': 'multiple_choice',
    'TRUE_FALSE': 'true_false',
    'SHORT_ANSWER': 'short_answer',
    'CODE_TRACE': 'code_trace',
}

difficulty_map = {
    'BEGINNER': 'easy',
    'INTERMEDIATE': 'medium',
    'ADVANCED': 'hard',
    'EASY': 'easy',
    'MEDIUM': 'medium',
    'HARD': 'hard',
}

quiz_type_map = {
    'DAILY_QUIZ': 'practice',
    'FULL_SIMULATION': 'mock_exam',
}

generated_mode_map = {
    'PRACTICE': 'practice',
    'MOCK': 'mock_exam',
}

review_status_map = {
    'APPROVED': 'approved',
    'REJECTED': 'rejected',
    'ARCHIVED': 'archived',
    'GENERATED': 'generated',
    'UNDER_REVIEW': 'under_review',
}

status_lower_map = {
    'ACTIVE': 'active',
    'INACTIVE': 'inactive',
    'PENDING': 'pending',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'SUCCESS': 'success',
    'OPEN': 'open',
    'IN_PROGRESS': 'in_progress',
    'RESOLVED': 'resolved',
    'CLOSED': 'closed',
    'LOW': 'low',
    'MEDIUM': 'medium',
    'HIGH': 'high',
    'URGENT': 'urgent',
}

def migrate_users():
    print('\n1. Migrating users...')
    columns = ['id', 'email', 'full_name', 'hashed_password', 'role', 'subscription_tier',
               'is_active', 'created_at', 'updated_at', 'last_active', 'totp_secret',
               'is_2fa_enabled', 'failed_login_attempts', 'locked_until', 'ai_usage_count',
               'last_ai_usage_date']
    
    with local_engine.connect() as conn:
        result = conn.execute(text(f'SELECT {", ".join(columns)} FROM users'))
        rows = result.fetchall()
    
    migrated = 0
    for row in rows:
        try:
            values = {}
            for col in columns:
                val = getattr(row, col)
                if col == 'role':
                    val = 'student' if val == 'STUDENT' else 'admin'
                elif col == 'subscription_tier':
                    val = 'free' if val == 'FREE' else 'premium'
                values[col] = val
            
            placeholders = ', '.join([f':{col}' for col in columns])
            insert_sql = f'INSERT INTO users ({", ".join(columns)}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
            
            with supabase_engine.connect() as conn:
                conn.execute(text(insert_sql), values)
                conn.commit()
            migrated += 1
        except Exception as e:
            if migrated == 0:
                print(f'  First error: {str(e)[:200]}')
    
    print(f'  ✅ users: {migrated}/{len(rows)}')

def migrate_questions():
    print('\n2. Migrating questions...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM questions'))
        total = result.scalar()
    print(f'  Found {total} rows')
    
    migrated = 0
    offset = 0
    batch_size = 50
    
    while offset < total:
        with local_engine.connect() as conn:
            result = conn.execute(text(f'''
                SELECT id, course_id, topic_id, question_type, difficulty, 
                       prompt, choices, correct_answer, explanation, created_at
                FROM questions LIMIT {batch_size} OFFSET {offset}
            '''))
            rows = result.fetchall()
        
        for row in rows:
            try:
                values = {
                    'id': row.id,
                    'course_id': row.course_id,
                    'topic_id': row.topic_id,
                    'question_type': question_type_map.get(row.question_type, 'multiple_choice'),
                    'difficulty': difficulty_map.get(row.difficulty, 'medium'),
                    'prompt': row.prompt,
                    'choices': json.dumps(row.choices) if row.choices else None,
                    'correct_answer': row.correct_answer,
                    'explanation': row.explanation,
                    'created_at': row.created_at,
                }
                
                insert_sql = '''INSERT INTO questions (id, course_id, topic_id, question_type, difficulty, 
                                                       prompt, choices, correct_answer, explanation, created_at)
                                VALUES (:id, :course_id, :topic_id, :question_type, :difficulty,
                                        :prompt, :choices, :correct_answer, :explanation, :created_at)
                                ON CONFLICT (id) DO NOTHING'''
                
                with supabase_engine.connect() as conn:
                    conn.execute(text(insert_sql), values)
                    conn.commit()
                migrated += 1
            except Exception as e:
                if migrated == 0:
                    print(f'  First error: {str(e)[:200]}')
        
        offset += batch_size
        print(f'  Progress: {migrated}/{total}')
    
    print(f'  ✅ questions: {migrated}/{total}')

def migrate_flashcards():
    print('\n3. Migrating flashcards...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text('SELECT * FROM flashcards'))
        rows = result.fetchall()
        columns = result.keys()
    
    migrated = 0
    for row in rows:
        try:
            values = {col: getattr(row, col) for col in columns}
            placeholders = ', '.join([f':{col}' for col in columns])
            insert_sql = f'INSERT INTO flashcards ({", ".join(columns)}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
            
            with supabase_engine.connect() as conn:
                conn.execute(text(insert_sql), values)
                conn.commit()
            migrated += 1
        except Exception as e:
            if migrated == 0:
                print(f'  First error: {str(e)[:200]}')
    
    print(f'  ✅ flashcards: {migrated}/{len(rows)}')

def migrate_quizzes():
    print('\n4. Migrating quizzes...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text('SELECT * FROM quizzes'))
        rows = result.fetchall()
        columns = list(result.keys())
    
    migrated = 0
    for row in rows:
        try:
            values = {}
            for col in columns:
                val = getattr(row, col)
                if col == 'quiz_type':
                    val = quiz_type_map.get(val, 'practice')
                elif col == 'generated_mode':
                    val = generated_mode_map.get(val, 'practice')
                values[col] = val
            
            placeholders = ', '.join([f':{col}' for col in columns])
            insert_sql = f'INSERT INTO quizzes ({", ".join(columns)}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
            
            with supabase_engine.connect() as conn:
                conn.execute(text(insert_sql), values)
                conn.commit()
            migrated += 1
        except Exception as e:
            if migrated == 0:
                print(f'  First error: {str(e)[:200]}')
    
    print(f'  ✅ quizzes: {migrated}/{len(rows)}')

def migrate_simple_table(table_name):
    print(f'\nMigrating {table_name}...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text(f'SELECT * FROM {table_name}'))
        rows = result.fetchall()
        columns = list(result.keys())
    
    migrated = 0
    for row in rows:
        try:
            values = {}
            for col in columns:
                val = getattr(row, col)
                values[col] = val
            
            placeholders = ', '.join([f':{col}' for col in columns])
            insert_sql = f'INSERT INTO {table_name} ({", ".join(columns)}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
            
            with supabase_engine.connect() as conn:
                conn.execute(text(insert_sql), values)
                conn.commit()
            migrated += 1
        except Exception as e:
            if migrated == 0:
                print(f'  First error: {str(e)[:200]}')
    
    print(f'  ✅ {table_name}: {migrated}/{len(rows)}')

# Run migrations
migrate_users()
migrate_questions()
migrate_flashcards()
migrate_quizzes()
migrate_simple_table('quiz_questions')
migrate_simple_table('support_tickets')
migrate_simple_table('code_trace_drills')

print('\n=== MIGRATION COMPLETE ===')
