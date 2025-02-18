let mediaRecorder;
let recordedChunks = [];

document.getElementById("start").addEventListener("click", async () => {
    let stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);

    mediaRecorder.start();
    document.getElementById("start").disabled = true;
    document.getElementById("stop").disabled = false;
});

document.getElementById("stop").addEventListener("click", () => {
    mediaRecorder.stop();

    mediaRecorder.onstop = async () => {
        let videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        let videoUrl = URL.createObjectURL(videoBlob);

      
        let videoLink = document.createElement("a");
        videoLink.href = videoUrl;
        videoLink.download = "meeting_recording.webm";
        videoLink.click();

        await extractAndSaveAudio(videoBlob);

        document.getElementById("start").disabled = false;
        document.getElementById("stop").disabled = true;
    };
});

async function extractAndSaveAudio(videoBlob) {
    const audioContext = new AudioContext();
    const arrayBuffer = await videoBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    
    const wavBlob = audioBufferToWav(audioBuffer);
    const wavUrl = URL.createObjectURL(wavBlob);

    let audioLink = document.createElement("a");
    audioLink.href = wavUrl;
    audioLink.download = "meeting_audio.wav";
    audioLink.click();

    uploadAudio(wavBlob);
}

async function uploadAudio(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "meeting_audio.wav");

    try {
        const response = await fetch("http://127.0.0.1:8000/upload-audio/", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
           
            const summaryContainer = document.getElementById("summaryContainer");
            const actionItemsContainer = document.getElementById("actionItemsContainer");

            summaryContainer.textContent = "Summary: " + data.summary;
            actionItemsContainer.innerHTML = "Action Items: <ul>" + data.action_items.map(item => `<li>${item}</li>`).join("") + "</ul>";
        } else {
            alert("Error: " + data.detail);
        }
    } catch (error) {
        console.error("Error uploading audio:", error);
        alert("An error occurred while uploading the audio.");
    }
}

function audioBufferToWav(audioBuffer) {
    let numberOfChannels = audioBuffer.numberOfChannels;
    let sampleRate = audioBuffer.sampleRate;
    let format = 1; // PCM
    let bitDepth = 16;

    let interleaved = interleave(audioBuffer);
    let byteRate = sampleRate * numberOfChannels * (bitDepth / 8);
    let blockAlign = numberOfChannels * (bitDepth / 8);
    let wavHeader = new ArrayBuffer(44);
    let view = new DataView(wavHeader);

 
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeString(view, 8, "WAVE");

   
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data subchunk
    writeString(view, 36, "data");
    view.setUint32(40, interleaved.length * 2, true);

    let audioBlob = new Blob([wavHeader, new Uint8Array(interleaved.buffer)], { type: "audio/wav" });
    return audioBlob;
}


function interleave(audioBuffer) {
    let numberOfChannels = audioBuffer.numberOfChannels;
    let length = audioBuffer.length * numberOfChannels;
    let result = new Float32Array(length);
    let offset = 0;

    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            result[offset++] = audioBuffer.getChannelData(channel)[i];
        }
    }

    let int16Array = new Int16Array(result.length);
    for (let i = 0; i < result.length; i++) {
        int16Array[i] = Math.max(-1, Math.min(1, result[i])) * 0x7FFF;
    }

    return int16Array;
}


function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
