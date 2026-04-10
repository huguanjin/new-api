import sqlite3
conn = sqlite3.connect(r'd:\My-LocalGitFile\09new-api\new-api\one-api.db')
c = conn.cursor()
for table in ['users', 'user_subscriptions', 'withdrawals']:
    c.execute(f"PRAGMA table_info(`{table}`)")
    cols = [row[1] for row in c.fetchall()]
    print(f"{table}: {cols}")
conn.close()
