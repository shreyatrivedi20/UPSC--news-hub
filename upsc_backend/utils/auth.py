import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_NAME


def init_auth_db():
    """Initialize the users table in the database"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print(f"✓ Auth database initialized")


def signup_user(username, email, password):
    """
    Register a new user
    
    Args:
        username: Username for the user
        email: Email address
        password: Plain text password (will be hashed)
    
    Returns:
        dict: {'status': 'success'/'error', 'message': str, 'user_id': int or None}
    """
    # Validation
    if not username or not email or not password:
        return {
            'status': 'error',
            'message': 'Username, email, and password are required',
            'user_id': None
        }
    
    if len(username) < 3:
        return {
            'status': 'error',
            'message': 'Username must be at least 3 characters long',
            'user_id': None
        }
    
    if len(password) < 6:
        return {
            'status': 'error',
            'message': 'Password must be at least 6 characters long',
            'user_id': None
        }
    
    # Basic email validation
    if '@' not in email or '.' not in email:
        return {
            'status': 'error',
            'message': 'Invalid email format',
            'user_id': None
        }
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Check if username already exists
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        if cursor.fetchone():
            conn.close()
            return {
                'status': 'error',
                'message': 'Username already exists',
                'user_id': None
            }
        
        # Check if email already exists
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            conn.close()
            return {
                'status': 'error',
                'message': 'Email already registered',
                'user_id': None
            }
        
        # Hash password and insert user
        password_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        ''', (username, email, password_hash))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'status': 'success',
            'message': 'User registered successfully',
            'user_id': user_id
        }
    
    except sqlite3.Error as e:
        conn.close()
        return {
            'status': 'error',
            'message': f'Database error: {str(e)}',
            'user_id': None
        }


def login_user(username, password):
    """
    Authenticate a user
    
    Args:
        username: Username or email
        password: Plain text password
    
    Returns:
        dict: {'status': 'success'/'error', 'message': str, 'user': dict or None}
    """
    if not username or not password:
        return {
            'status': 'error',
            'message': 'Username and password are required',
            'user': None
        }
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        # Try to find user by username or email
        cursor.execute('''
            SELECT id, username, email, password_hash FROM users 
            WHERE username = ? OR email = ?
        ''', (username, username))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {
                'status': 'error',
                'message': 'Invalid username or password',
                'user': None
            }
        
        user_id, db_username, db_email, password_hash = row
        
        # Verify password
        if check_password_hash(password_hash, password):
            return {
                'status': 'success',
                'message': 'Login successful',
                'user': {
                    'id': user_id,
                    'username': db_username,
                    'email': db_email
                }
            }
        else:
            return {
                'status': 'error',
                'message': 'Invalid username or password',
                'user': None
            }
    
    except sqlite3.Error as e:
        conn.close()
        return {
            'status': 'error',
            'message': f'Database error: {str(e)}',
            'user': None
        }


def get_user_by_id(user_id):
    """
    Get user information by ID
    
    Args:
        user_id: User ID
    
    Returns:
        dict: User information or None
    """
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT id, username, email, created_at FROM users WHERE id = ?
        ''', (user_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'email': row[2],
                'created_at': row[3]
            }
        return None
    
    except sqlite3.Error:
        conn.close()
        return None


def check_username_exists(username):
    """Check if a username already exists"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def check_email_exists(email):
    """Check if an email already exists"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

