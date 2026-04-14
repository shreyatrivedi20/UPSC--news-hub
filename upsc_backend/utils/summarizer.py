from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import SUMMARY_SENTENCES, CRISP_SUMMARY_SENTENCES

def summarize_text(text, sentences=None):
    """
    Summarize text using LSA algorithm
    
    Args:
        text: Text to summarize
        sentences: Number of sentences in summary (default from config)
    
    Returns:
        Summarized text
    """
    if not text or len(text.strip()) < 100:
        return text
    
    if sentences is None:
        sentences = SUMMARY_SENTENCES
    
    try:
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LsaSummarizer()
        summary = summarizer(parser.document, sentences)
        result = ' '.join([str(sentence) for sentence in summary])
        return result
    except Exception as e:
        print(f"⚠ Summarization error: {str(e)}")
        # Fallback: return first N sentences
        sentences_list = text.split('.')[:sentences]
        return '.'.join(sentences_list) + '.'

def summarize_text_crisp(text):
    """
    Generate a shorter, crisper summary – useful for very long articles
    where you just need the key takeaway.

    This intentionally uses fewer sentences than the standard summary
    (controlled by CRISP_SUMMARY_SENTENCES in config).
    """
    if not text or len(text.strip()) < 100:
        return text

    return summarize_text(text, sentences=CRISP_SUMMARY_SENTENCES)

def get_summary_stats(text, summary):
    """Get statistics about the summarization"""
    if not text or not summary:
        return None
    
    return {
        'original_length': len(text),
        'summary_length': len(summary),
        'compression_ratio': round((1 - len(summary) / len(text)) * 100, 2),
        'original_words': len(text.split()),
        'summary_words': len(summary.split())
    }