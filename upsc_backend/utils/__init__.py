# utils/__init__.py

from .rss_fetcher import (
    init_db,
    fetch_and_store_news,
    get_all_news,
    get_article_by_id,
    update_article_summary,
    search_news
)
from .summarizer import summarize_text, summarize_text_crisp, get_summary_stats
from .tts import text_to_audio_buffer, text_to_audio_file, list_audio_files
from .auth import signup_user, login_user, get_user_by_id

__all__ = [
    'init_db',
    'fetch_and_store_news',
    'get_all_news',
    'get_article_by_id',
    'update_article_summary',
    'search_news',
    'summarize_text',
    'summarize_text_crisp',
    'get_summary_stats',
    'text_to_audio_buffer',
    'text_to_audio_file',
    'list_audio_files',
    'signup_user',
    'login_user',
    'get_user_by_id'
]
