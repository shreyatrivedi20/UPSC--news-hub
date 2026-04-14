import os

# Base directory - points to upsc_backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database configuration
DB_NAME = os.path.join(BASE_DIR, 'database.db')

# Folders
AUDIO_FOLDER = os.path.join(BASE_DIR, 'audio')
NEWS_DATA_FOLDER = os.path.join(BASE_DIR, 'news_data')

# Create folders if they don't exist
os.makedirs(AUDIO_FOLDER, exist_ok=True)
os.makedirs(NEWS_DATA_FOLDER, exist_ok=True)

# RSS Feed URLs for UPSC-relevant sources
RSS_FEEDS = [
    # The Hindu RSS (correct ones)
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://www.thehindu.com/news/international/feeder/default.rss",
    "https://www.thehindu.com/business/feeder/default.rss",

    # PIB (Govt releases)
    "https://pib.gov.in/rss/pib_rss.xml",

    # Indian Express (works perfectly)
    "https://indianexpress.com/section/india/feed/",
    "https://indianexpress.com/section/world/feed/",

    # LiveMint (correct RSS feed)
    "https://www.livemint.com/rss/markets",
    "https://www.livemint.com/rss/politics",
    "https://www.livemint.com/rss/opinion"

]

# Summarizer settings
SUMMARY_SENTENCES = 3         # Number of sentences in standard summary
CRISP_SUMMARY_SENTENCES = 2   # Number of sentences in "crisp" summary for big articles

# Server settings
HOST = '0.0.0.0'
PORT = 5000
DEBUG = True

# CORS settings (for frontend integration)
CORS_ORIGINS = [
    'http://localhost:3000',  # React default port
    'http://localhost:5173',  # Vite default port
    'http://localhost:8080',  # Vue default port
]