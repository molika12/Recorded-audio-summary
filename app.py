from fastapi import FastAPI, File, UploadFile
import whisper
from transformers import pipeline
import os

app = FastAPI()


whisper_model = whisper.load_model("base")
summarizer = pipeline("summarization", model="t5-small")

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile = File(...)):
    file_location = f"temp/{file.filename}"

    with open(file_location, "wb") as f:
        f.write(await file.read())


    try:
        transcript = whisper_model.transcribe(file_location)["text"]
        print(f"Transcript: {transcript}")  # Log transcript for debugging
    except Exception as e:
        print(f"Error transcribing: {e}")
        return {"detail": "Error transcribing the audio"}

   
    try:
        summary = summarizer(transcript, max_length=150, min_length=50, do_sample=False)[0]["summary_text"]
        print(f"Summary: {summary}")  # Log summary for debugging
    except Exception as e:
        print(f"Error summarizing: {e}")
        return {"detail": "Error summarizing the transcript"}

    
    action_items = extract_action_items(summary)

    return {"summary": summary, "action_items": action_items}

# Extract action items from summary
def extract_action_items(summary):
    action_items = []
    for sentence in summary.split("."):
        if "should" in sentence or "need to" in sentence or "action" in sentence:
            action_items.append("- " + sentence.strip())
    return action_items
