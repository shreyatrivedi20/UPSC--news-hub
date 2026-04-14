from gtts import gTTS
from io import BytesIO
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import AUDIO_FOLDER

def generate_audio_file(text, filename=None, lang='en', slow=False):
    """
    Generate MP3 audio file from text
    
    Args:
        text: Text to convert
        filename: Optional filename to save (without extension)
        lang: Language code (default 'en')
        slow: Slow speech speed (default False)
    
    Returns:
        BytesIO buffer with audio data or file path if filename provided
    """
    if not text:
        raise ValueError("No text provided for TTS")
    
    try:
        tts = gTTS(text=text, lang=lang, slow=slow)
        
        if filename:
            # Save to file
            filepath = os.path.join(AUDIO_FOLDER, f"{filename}.mp3")
            tts.save(filepath)
            print(f"✓ Audio saved: {filepath}")
            return filepath
        else:
            # Return buffer
            audio_buffer = BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            return audio_buffer
    except Exception as e:
        raise Exception(f"TTS generation failed: {str(e)}")

def text_to_audio_buffer(text, lang='en', slow=False):
    """Generate audio buffer from text (for streaming)"""
    return generate_audio_file(text, filename=None, lang=lang, slow=slow)

def text_to_audio_file(text, filename, lang='en', slow=False):
    """Generate audio file from text (for storage)"""
    return generate_audio_file(text, filename=filename, lang=lang, slow=slow)

def list_audio_files():
    """List all generated audio files"""
    if not os.path.exists(AUDIO_FOLDER):
        return []
    
    files = [f for f in os.listdir(AUDIO_FOLDER) if f.endswith('.mp3')]
    return files

def delete_audio_file(filename):
    """Delete an audio file"""
    filepath = os.path.join(AUDIO_FOLDER, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False
