from sqlalchemy import create_engine, text
import json

local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
from app.core.database import engine as supabase_engine

# Type conversion mappings
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
}

def migrate_questions():
    print('\nMigrating questions...')
    
    with local_engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM questions'))
        total = result.scalar()
    print(f'  Found {total} rows')
    
    migrated = 0
    offset = 0
    batch_size = 50
    
    while offset < total:
        with local_engine.connect() as local_conn:
            result = local_conn.execute(text(f'''
                SELECT id, course_id, topic_id, question_type, difficulty, 
                       prompt, choices, correct_answer, explanation, created_at
                FROM questions
                LIMIT {batch_size} OFFSET {offset}
            '''))
            rows = result.fetchall()
        
        for row in rows:
            try:
                # Convert values
                q_type = question_type_map.get(row.question_type, 'multiple_choice')
                diff = difficulty_map.get(row.difficulty, 'medium')
                choices_json = json.dumps(row.choices) if row.choices else None
                
                insert_sql = '''
                    INSERT INTO questions (id, course_id, topic_id, question_type, difficulty, 
                                           prompt, choices, correct_answer, explanation, created_at)
                    VALUES (:id, :course_id, :topic_id, :question_type, :difficulty,
                            :prompt, :choices, :correct_answer, :explanation, :created_at)
                    ON CONFLICT (id) DO NOTHING
                '''
                
                with supabase_engine.connect() as supabase_conn:
                    supabase_conn.execute(text(insert_sql), {
                        'id': row.id,
                        'course_id': row.course_id,
                        'topic_id': row.topic_id,
                        'question_type': q_type,
                        'difficulty': diff,
                        'prompt': row.prompt,
                        'choices': choices_json,
                        'correct_answer': row.correct_answer,
                        'explanation': row.explanation,
                        'created_at': row.created_at,
                    })
                    supabase_conn.commit()
                migrated += 1
            except Exception as e:
                if migrated == 0:
                    print(f'  First error: {str(e)[:200]}')
        
        offset += batch_size
        print(f'  Progress: {migrated}/{total}')
    
    print(f'  ✅ questions: {migrated} rows migrated')

migrate_questions()
