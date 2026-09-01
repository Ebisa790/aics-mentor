from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

# Get course mapping by NAME
print('=== COURSE MAPPING BY NAME ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT id, code, name FROM courses'))
    local_courses = {row.name: (row.id, row.code) for row in result}

with supabase_engine.connect() as conn:
    result = conn.execute(text('SELECT id, code, name FROM courses'))
    supabase_courses = {row.name: (row.id, row.code) for row in result}

course_id_map = {}
unmatched = []

for name, (local_id, local_code) in local_courses.items():
    if name in supabase_courses:
        supabase_id, supabase_code = supabase_courses[name]
        course_id_map[local_id] = supabase_id
        print(f'  ✅ {name}: {local_code} → {supabase_code}')
    else:
        unmatched.append(f'{name} ({local_code})')
        print(f'  ❌ {name}: no match')

print(f'\nMatched: {len(course_id_map)}/16')
if unmatched:
    print(f'Unmatched: {unmatched}')

# Now migrate questions
print('\n=== MIGRATING QUESTIONS ===')
with local_engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM questions'))
    total = result.scalar()
print(f'Found {total} questions')

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
            new_course_id = course_id_map.get(row.course_id)
            if new_course_id is None:
                continue
            
            q_type_map = {'MULTIPLE_CHOICE': 'multiple_choice', 'SHORT_ANSWER': 'short_answer'}
            diff_map = {'BEGINNER': 'beginner', 'INTERMEDIATE': 'intermediate', 'ADVANCED': 'advanced'}
            
            values = {
                'id': row.id,
                'course_id': new_course_id,
                'topic_id': row.topic_id,
                'question_type': q_type_map.get(row.question_type, 'multiple_choice'),
                'difficulty': diff_map.get(row.difficulty, 'beginner'),
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

print(f'\n✅ Questions migrated: {migrated}/{total}')
