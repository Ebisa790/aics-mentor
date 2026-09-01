from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

# 1. Fix flashcards - make note_id nullable or set to NULL
print('=== FIXING FLASHCARDS ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT * FROM flashcards'))
    rows = result.fetchall()
    columns = list(result.keys())

migrated = 0
for row in rows:
    values = {}
    for col in columns:
        val = getattr(row, col)
        if col == 'note_id':
            val = None  # Set to NULL to avoid FK issue
        if isinstance(val, dict):
            val = json.dumps(val)
        values[col] = val
    
    placeholders = ', '.join([f':{col}' for col in columns])
    col_list = ', '.join(columns)
    insert_sql = f'INSERT INTO flashcards ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
    
    try:
        with supabase_engine.connect() as conn:
            conn.execute(text(insert_sql), values)
            conn.commit()
        migrated += 1
    except Exception as e:
        if migrated == 0:
            print(f'  First error: {str(e)[:200]}')

print(f'  ✅ Flashcards: {migrated}/{len(rows)}')

# 2. Fix quizzes - map generated_mode correctly
print('\n=== FIXING QUIZZES ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT * FROM quizzes'))
    rows = result.fetchall()
    columns = list(result.keys())

mode_map = {'PRACTICE': 'practice', 'MOCK': 'mock'}
quiz_type_map = {'DAILY_QUIZ': 'daily_quiz', 'FULL_SIMULATION': 'full_simulation', 'CHAPTER_TEST': 'chapter_test', 'WEEKLY_EXAM': 'weekly_exam'}

migrated = 0
for row in rows:
    values = {}
    for col in columns:
        val = getattr(row, col)
        if col == 'quiz_type':
            val = quiz_type_map.get(val, 'daily_quiz')
        elif col == 'generated_mode':
            val = mode_map.get(val, 'practice')
        if isinstance(val, dict):
            val = json.dumps(val)
        values[col] = val
    
    placeholders = ', '.join([f':{col}' for col in columns])
    col_list = ', '.join(columns)
    insert_sql = f'INSERT INTO quizzes ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
    
    try:
        with supabase_engine.connect() as conn:
            conn.execute(text(insert_sql), values)
            conn.commit()
        migrated += 1
    except Exception as e:
        if migrated == 0:
            print(f'  First error: {str(e)[:200]}')

print(f'  ✅ Quizzes: {migrated}/{len(rows)}')

# 3. Fix quiz_questions
print('\n=== MIGRATING QUIZ QUESTIONS ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT * FROM quiz_questions'))
    rows = result.fetchall()
    columns = list(result.keys())

migrated = 0
for row in rows:
    values = {}
    for col in columns:
        val = getattr(row, col)
        if isinstance(val, dict):
            val = json.dumps(val)
        values[col] = val
    
    placeholders = ', '.join([f':{col}' for col in columns])
    col_list = ', '.join(columns)
    insert_sql = f'INSERT INTO quiz_questions ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
    
    try:
        with supabase_engine.connect() as conn:
            conn.execute(text(insert_sql), values)
            conn.commit()
        migrated += 1
    except Exception as e:
        if migrated == 0:
            print(f'  First error: {str(e)[:200]}')

print(f'  ✅ Quiz Questions: {migrated}/{len(rows)}')

# 4. Fix code_trace_drills - convert arrays to JSON
print('\n=== FIXING CODE TRACE DRILLS ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT * FROM code_trace_drills'))
    rows = result.fetchall()
    columns = list(result.keys())

migrated = 0
for row in rows:
    values = {}
    for col in columns:
        val = getattr(row, col)
        if col in ('trace_steps', 'options') and isinstance(val, list):
            val = json.dumps(val)
        values[col] = val
    
    placeholders = ', '.join([f':{col}' for col in columns])
    col_list = ', '.join(columns)
    insert_sql = f'INSERT INTO code_trace_drills ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
    
    try:
        with supabase_engine.connect() as conn:
            conn.execute(text(insert_sql), values)
            conn.commit()
        migrated += 1
    except Exception as e:
        if migrated == 0:
            print(f'  First error: {str(e)[:200]}')

print(f'  ✅ Code Trace Drills: {migrated}/{len(rows)}')

print('\n=== ALL FIXES COMPLETE ===')
