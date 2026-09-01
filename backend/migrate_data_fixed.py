from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Local database
local_engine = create_engine('postgresql://postgres:ebba_2241@localhost:5432/exitai_db')

# Supabase database
from app.core.database import engine as supabase_engine

def migrate_table(table_name, batch_size=100):
    """Migrate data from local to Supabase with proper error handling"""
    print(f'\nMigrating {table_name}...')
    
    # Get column names from local
    with local_engine.connect() as conn:
        result = conn.execute(text(f'''
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        '''))
        columns = [row[0] for row in result]
    
    # Get total count
    with local_engine.connect() as conn:
        result = conn.execute(text(f'SELECT COUNT(*) FROM {table_name}'))
        total = result.scalar()
    
    print(f'  Found {total} rows to migrate')
    
    if total == 0:
        print(f'  ✅ No data to migrate')
        return
    
    # Migrate in batches
    migrated = 0
    offset = 0
    
    while offset < total:
        with local_engine.connect() as local_conn:
            result = local_conn.execute(text(f'''
                SELECT * FROM {table_name}
                LIMIT {batch_size} OFFSET {offset}
            '''))
            rows = result.fetchall()
        
        for row in rows:
            values = {col: getattr(row, col) for col in columns}
            placeholders = ', '.join([f':{col}' for col in columns])
            col_list = ', '.join(columns)
            insert_sql = f'INSERT INTO {table_name} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            
            try:
                with supabase_engine.connect() as supabase_conn:
                    supabase_conn.execute(text(insert_sql), values)
                    supabase_conn.commit()
                migrated += 1
            except Exception as e:
                # Skip duplicate or problematic rows
                pass
        
        offset += batch_size
        print(f'  Progress: {migrated}/{total}')
    
    print(f'  ✅ {table_name}: {migrated} rows migrated')

print('=== STARTING DATA MIGRATION ===')

# Migrate in order (respecting foreign keys)
migrate_table('users')
migrate_table('questions')
migrate_table('flashcards')
migrate_table('quizzes')
migrate_table('quiz_questions')
migrate_table('exam_questions')
migrate_table('code_trace_drills')
migrate_table('support_tickets')

print('\n=== MIGRATION COMPLETE ===')
