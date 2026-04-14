import feedparser
import hashlib
import sqlite3
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_NAME, RSS_FEEDS



def init_db():
    """Initialize the SQLite database with news table and users table"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT UNIQUE NOT NULL,
            date TEXT,
            summary TEXT,
            content_hash TEXT UNIQUE,
            full_content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Also initialize auth table
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
    print(f"✓ Database initialized at {DB_NAME}")


def fetch_article_content(url):
    """Fetch full article content from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=10, headers=headers)
        soup = BeautifulSoup(response.content, 'html.parser')

        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe']):
            element.decompose()

        # Extract text
        text = soup.get_text(separator=' ', strip=True)

        # Clean whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)

        return text[:8000]  # Limit to 8000 chars
    except Exception as e:
        print(f"  ⚠ Error fetching content from {url}: {str(e)}")
        return ""


def fetch_and_store_news():
    """Fetch news from RSS feeds and store in database"""
    # --- DEBUG — print DB path and feeds to confirm config loaded ---
    import os
    print("DEBUG: DB PATH:", os.path.abspath(DB_NAME))
    print("DEBUG: RSS FEEDS:")
    for f in RSS_FEEDS:
        print(" -", f)
    

    # 🔥 DEBUG PRINTS ADDED
    print("DB PATH:", os.path.abspath(DB_NAME))
    print("RSS FEEDS:", RSS_FEEDS)

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    new_articles = 0

    print("\n" + "="*60)
    print("FETCHING NEWS FROM RSS FEEDS")
    print("="*60)

    for feed_url in RSS_FEEDS:
        try:
            print(f"\n📡 Fetching from: {feed_url}")
            feed = feedparser.parse(
                feed_url,
                 agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            )


            # 🔥 DEBUG PRINT ADDED
            print("Fetched entries:", len(feed.entries))

            if not feed.entries:
                print(f"  ⚠ No entries found")
                continue

            for entry in feed.entries[:15]:  # Limit to 15 per feed
                title = entry.get('title', 'No Title')
                link = entry.get('link', '')

                # Parse date
                published = entry.get('published_parsed') or entry.get('updated_parsed')
                if published:
                    date = datetime(*published[:6]).strftime('%Y-%m-%d %H:%M:%S')
                else:
                    date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                # Content hash
                content_hash = hashlib.md5(f"{title}{link}".encode()).hexdigest()

                # Prevent duplicates
                cursor.execute('SELECT id FROM news WHERE content_hash = ?', (content_hash,))
                if cursor.fetchone():
                    continue

                # Fetch full content
                full_content = entry.get('summary', '') or entry.get('description', '')
                if link:
                    fetched = fetch_article_content(link)
                    if fetched and len(fetched) > len(full_content):
                        full_content = fetched

                try:
                    cursor.execute('''
                        INSERT INTO news (title, link, date, content_hash, full_content)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (title, link, date, content_hash, full_content))

                    new_articles += 1
                    print(f"  ✓ Added: {title[:60]}...")

                except sqlite3.IntegrityError:
                    continue

        except Exception as e:
            print(f"  ✗ Error fetching from {feed_url}: {str(e)}")

    conn.commit()
    conn.close()

    print("\n" + "="*60)
    print(f"✓ COMPLETED: Fetched {new_articles} new articles")
    print("="*60 + "\n")

    return new_articles


UPSC_TOPICS = {
    "Polity & Governance": [
        "parliament", "constitution", "supreme court", "high court", "lok sabha",
        "rajya sabha", "president", "governor", "bill", "ordinance", "election commission",
        "panchayat", "federal", "governance", "policy", "cabinet", "ministry"
    ],
    "Economy": [
        "gdp", "inflation", "rbi", "monetary policy", "fiscal", "budget", "tax", "gst",
        "unemployment", "economic growth", "industrial production", "exports", "imports",
        "current account", "fdi", "markets", "stock", "disinvestment"
    ],
    "International Relations": [
        "united nations", "unsc", "bilateral", "multilateral", "summit", "treaty", "border",
        "china", "pakistan", "russia", "usa", "neighbourhood", "diplomatic", "foreign policy"
    ],
    "Environment & Ecology": [
        "climate", "global warming", "emissions", "pollution", "biodiversity", "wildlife",
        "reserve", "forest", "environment ministry", "cop", "carbon", "renewable", "solar",
        "wind power", "conservation"
    ],
    "Science & Technology": [
        "isro", "drdo", "satellite", "mission", "space", "technology", "ai", "artificial intelligence",
        "quantum", "nuclear", "research", "innovation", "biotech", "vaccine"
    ],
    "Social Issues": [
        "health", "education", "literacy", "poverty", "inequality", "women", "child", "gender",
        "reservation", "caste", "tribal", "minority", "welfare", "scheme", "social justice"
    ],
    "Security & Disaster Management": [
        "terrorism", "naxal", "insurgency", "border security", "bsf", "crpf", "cyber security",
        "disaster", "flood", "earthquake", "cyclone", "ndrf", "internal security"
    ],
}


def _normalize_topic_string(s):
    """Normalize topic / query strings for loose matching (e.g. 'science & technology' == 'science and technology')."""
    if not s:
        return ""
    s = s.lower()
    s = s.replace("&", "and")
    # remove extra spaces
    s = " ".join(s.split())
    return s


def infer_upsc_topic(title, content=None):
    """Infer the most relevant UPSC topic based on simple keyword matching."""
    if not title and not content:
        return "General / Miscellaneous"

    text = f"{title or ''} {content or ''}".lower()

    best_topic = "General / Miscellaneous"
    best_count = 0

    for topic, keywords in UPSC_TOPICS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > best_count:
            best_count = count
            best_topic = topic

    return best_topic


def get_all_news(limit=None, offset=0):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    if limit:
        cursor.execute(
            'SELECT id, title, link, date, summary FROM news ORDER BY date DESC LIMIT ? OFFSET ?',
            (limit, offset)
        )
    else:
        cursor.execute('SELECT id, title, link, date, summary FROM news ORDER BY date DESC')

    rows = cursor.fetchall()

    cursor.execute('SELECT COUNT(*) FROM news')
    total_count = cursor.fetchone()[0]

    conn.close()

    news_list = []
    for row in rows:
        title = row[1]
        topic = infer_upsc_topic(title)

        news_list.append({
            'id': row[0],
            'title': title,
            'link': row[2],
            'date': row[3],
            'summary': row[4],
            'topic': topic,
        })

    return news_list, total_count


def get_article_by_id(article_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id, title, link, date, summary, full_content FROM news WHERE id = ?',
        (article_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        title = row[1]
        full_content = row[5]
        topic = infer_upsc_topic(title, full_content)

        return {
            'id': row[0],
            'title': title,
            'link': row[2],
            'date': row[3],
            'summary': row[4],
            'full_content': full_content,
            'topic': topic,
        }
    return None


def update_article_summary(article_id, summary):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE news SET summary = ? WHERE id = ?', (summary, article_id))
    conn.commit()
    conn.close()


def search_news(query):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # First, check if the query looks like a UPSC topic label
    normalized_query = _normalize_topic_string(query)
    requested_topic = None
    for topic in UPSC_TOPICS.keys():
        if _normalize_topic_string(topic) == normalized_query:
            requested_topic = topic
            break

    if requested_topic:
        # Topic filter: fetch all news and filter by inferred topic
        cursor.execute('''
            SELECT id, title, link, date, summary, full_content
            FROM news
            ORDER BY date DESC
        ''')
        rows = cursor.fetchall()
    else:
        # Regular keyword search on title / content
        search_pattern = f"%{query}%"
        cursor.execute('''
            SELECT id, title, link, date, summary, full_content
            FROM news 
            WHERE title LIKE ? OR full_content LIKE ?
            ORDER BY date DESC
        ''', (search_pattern, search_pattern))
        rows = cursor.fetchall()

    conn.close()

    news_list = []
    for row in rows:
        title = row[1]
        full_content = row[5]
        topic = infer_upsc_topic(title, full_content)

        if requested_topic and topic != requested_topic:
            continue

        news_list.append({
            'id': row[0],
            'title': title,
            'link': row[2],
            'date': row[3],
            'summary': row[4],
            'topic': topic,
        })

    return news_list 
