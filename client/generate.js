let countdownInterval; // save timer
let songsArr=[]
async function generatePlaylist() {
    const moodInput = document.getElementById('moodInput');
    const mood = moodInput.value;
    const generateBtn = document.getElementById('generateBtn');
    const resultsDiv = document.getElementById('results');
    const loader = document.getElementById('loader');
    const timerDisplay = document.getElementById('timerDisplay');

    if (!mood) return alert('please enter mood');

    loader.style.display = 'block';
    resultsDiv.innerHTML = '';
    timerDisplay.innerText = '';
    generateBtn.disabled = true; 

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood: mood })
        });
        
        const data = await response.json();
        loader.style.display = 'none';

        if (response.status === 429) {//check if had too many request
            const waitTime = data.errorType === 'SERVER_LIMIT' ? 600 : 60;
            
            timerDisplay.innerText = data.error; 
            startTimer(waitTime);
            return;
        }

        if (!response.ok) {//check if any other problem
            throw new Error(data.error || 'Server error');
        }
        songsArr = data.songs;
        renderSongs(data.songs);
        generateBtn.disabled = false; 

    } catch (error) {
        console.error('Error:', error);
        loader.style.display = 'none';
        generateBtn.disabled = false;
        alert('error made while contact with server');
    }
}

function renderSongs(songs) {
    const resultsDiv = document.getElementById('results');
    if (!songs || songs.length === 0) return;

    const ul = document.createElement('ul');//list of songs
    songs.forEach(song => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${song.track}</strong> - ${song.artist}`;
        ul.appendChild(li);
    });
    resultsDiv.appendChild(ul);
const saveBtn = document.createElement('button');
saveBtn.innerText = 'SAVE TO SPOTIFY 💾';

    Object.assign(saveBtn.style, {
        marginTop: '30px',
        backgroundColor: '#1DB954',
        color: 'white',
        fontSize: '14px',
        fontWeight: '700',
        padding: '14px 32px',
        border: 'none',
        borderRadius: '500px',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        transition: 'transform 0.2s, background-color 0.2s'
    });
    saveBtn.onmouseover = () => {
        saveBtn.style.backgroundColor = '#1ed760';
        saveBtn.style.transform = 'scale(1.04)';
    };

    saveBtn.onmouseout = () => {
        saveBtn.style.backgroundColor = '#1DB954';
        saveBtn.style.transform = 'scale(1)';
    };
    saveBtn.onmousedown = () => {
        saveBtn.style.transform = 'scale(0.96)';
    };

    saveBtn.onclick = saveToSpotify; 
    resultsDiv.appendChild(saveBtn);

}

async function saveToSpotify() {
 
    const mood = document.getElementById('moodInput').value;
    const saveBtn = document.querySelector('#results button'); //find saveBtn

    if (!songsArr) return alert('cannot find those songs');

    saveBtn.disabled = true;
    saveBtn.innerText = 'saving... ⏳';

    try {
        const response = await fetch('/save-playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs: songsArr, mood: mood })
        });

        const data = await response.json();

        if (data.success) {
            saveBtn.innerText = 'saved successfully! ✅';
            
            const resultsDiv = document.getElementById('results');
            const link = document.createElement('p');
            link.style.marginTop = '15px';
            link.innerHTML = `🎉 your playlist is ready! <a href="${data.playlistUrl}" target="_blank" style="color: #1DB954; font-weight:bold; text-decoration: none;">לחץ כאן לפתיחה בספוטיפיי</a>`;
            resultsDiv.appendChild(link);
        } else {
            alert('error: ' + (data.error || 'could not save your playlist'));
            saveBtn.innerText = 'try again ❌';
            saveBtn.disabled = false;
        }

    } catch (error) {
        console.error('Save Error:', error);
        alert('connection error');
        saveBtn.innerText = 'save in Spotify 💾';
        saveBtn.disabled = false;
    }
}



function startTimer(duration) {
    const generateBtn = document.getElementById('generateBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    
    let timer = duration;
    
    if (countdownInterval) clearInterval(countdownInterval);//reset interval

    countdownInterval = setInterval(function () {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);

        const displayMin = minutes < 10 ? "0" + minutes : minutes;
        const displaySec = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = `Please wait: ${displayMin}:${displaySec}`;

        if (--timer < 0) {
            clearInterval(countdownInterval);
            timerDisplay.textContent = "";
            generateBtn.disabled = false;
        }
    }, 1000);
}