from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json

# Local database
local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')
LocalSession = sessionmaker(bind=local_engine)

# Supabase database
from app.core.database import engine as supabase_engine
SupabaseSession = sessionmaker(bind=supabase_engine)

def migrate_table(table_name, columns=None, where_clause=None):
    """Migrate data from local to Supabase"""
    local = LocalSession()
    supabase = SupabaseSession()
    
    try:
        # Get data from local
        if where_clause:
            result = local.execute(text(f'SELECT * FROM {table_name} WHERE {where_clause}'))
        else:
            result = local.execute(text(f'SELECT * FROM {table_name}'))
        
        rows = result.fetchall()
        if not rows:
            print(f'  {table_name}: 0 rows (skipped)')
            return
        
        # Get column names
        columns_result = local.execute(text(f'''
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        '''))
        col_names = [row[0] for row in columns_result]
        
        # Insert into Supabase
        for row in rows:
            placeholders = ', '.join([f':{col}' for col in col_names])
            values = {col: getattr(row, col) for col in col_names}
            insert_sql = f'INSERT INTO {table_name} ({", ".join(col_names)}) VALUES ({placeholders})'
            
            try:
                supabase.execute(text(insert_sql), values)
            except Exception as e:
                if 'duplicate' in str(e).lower():
                    pass  # Skip duplicates
                else:
                    print(f'  Error inserting: {str(e)[:100]}')
        
        supabase.commit()
        print(f'  ✅ {table_name}: {len(rows)} rows migrated')
    except Exception as e:
        print(f'  ❌ {table_name}: {str(e)[:100]}')
    finally:
        local.close()
        supabase.close()

print('=== STARTING DATA MIGRATION ===')
print()

# Migrate in order (respecting foreign keys)
print('1. Users:')
migrate_table('users')

print('2. Questions:')
migrate_table('questions')

print('3. Flashcards:')
migrate_table('flashcards')

print('4. Quizzes:')
migrate_table('quizzes')

print('5. Quiz Questions:')
migrate_table('quiz_questions')

print('6. Exam Questions:')
migrate_table('exam_questions')

print('7. Code Trace Drills:')
migrate_table('code_trace_drills')

print('8. Support Tickets:')
migrate_table('support_tickets')

print()
print('=== MIGRATION COMPLETE ===')
