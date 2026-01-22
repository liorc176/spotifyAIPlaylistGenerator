let countdownInterval; // save timer
let songsArr=[]
function updateDualSlider() {
    const rangeStart = document.getElementById('rangeStart');
    const rangeEnd = document.getElementById('rangeEnd');
    const startDisplay = document.getElementById('startYearDisplay');
    const endDisplay = document.getElementById('endYearDisplay');
    const sliderFill = document.getElementById('sliderFill');

    let startVal = parseInt(rangeStart.value);
    let endVal = parseInt(rangeEnd.value);
    const minGap = 10; 

    if (endVal - startVal <= minGap) {
        if (event.target.id === 'rangeStart') {
            rangeStart.value = endVal - minGap;
            startVal = endVal - minGap;
        } else {
            rangeEnd.value = startVal + minGap;
            endVal = startVal + minGap;
        }
    }

    startDisplay.innerText = startVal;
    endDisplay.innerText = endVal;

    const min = parseInt(rangeStart.min);
    const max = parseInt(rangeStart.max);
    
    const startPercent = ((startVal - min) / (max - min)) * 100;
    const endPercent = ((endVal - min) / (max - min)) * 100;

    sliderFill.style.left = startPercent + "%";
    sliderFill.style.width = (endPercent - startPercent) + "%";
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('rangeStart')) {
        updateDualSlider();
    }
});

function openModal() {
    document.getElementById('filterModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('filterModal').style.display = 'none';
    const hasFilters = (document.getElementById('genreInput').value) || 
                       (document.getElementById('artistInput').value) || 
                       (document.getElementById('songCountInput').value!=20);
    
    const filterBtn = document.getElementById('filterBtn');
    if(hasFilters) {
        filterBtn.innerText = "Filter Active ✅";
        filterBtn.style.border = "1px solid #1DB954";
    } else {
        filterBtn.innerText = "➕ Add Filter";
        filterBtn.style.border = "none";
    }
}
function showAlert(message,onConfirm= null) {
    document.getElementById('customAlertText').innerText = message;
    document.getElementById('customAlertModal').style.display = 'flex';
    const btn = document.getElementById('customAlertBtn');
    
    btn.onclick = function() {
        closeCustomAlert(); 
        if (onConfirm) {
            onConfirm(); 
        }
    };
}
function closeCustomAlert() {
    document.getElementById('customAlertModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('filterModal');
    if (event.target == modal) {
        closeModal();
    }
}

async function ensureAuthenticated() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            showAlert('Your session has expired. Please log in again.', () => {
                window.location.href = '/login';});   
                return false;
        }
        return true; 
    } catch (error) {
        console.error("Auth check failed:", error);
        return false;
    }
}
async function generatePlaylist() {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) return; 

    const moodInput = document.getElementById('moodInput');
    const mood = moodInput.value;
    const generateBtn = document.getElementById('generateBtn');
    const resultsDiv = document.getElementById('results');
    const loader = document.getElementById('loader');
    const timerDisplay = document.getElementById('timerDisplay');
    const genre = document.getElementById('genreInput').value;
    const artist = document.getElementById('artistInput').value;
    const songCount = document.getElementById('songCountInput').value;
    const startYear = document.getElementById('rangeStart').value;
    const endYear = document.getElementById('rangeEnd').value;
    if (!mood){ 
        showAlert('please enter mood');
        return
    }
    loader.style.display = 'block';
    resultsDiv.innerHTML = '';
    timerDisplay.innerText = '';
    generateBtn.disabled = true; 

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mood: mood,
                genre: genre,
                artist: artist,
                startYear: startYear, 
                endYear: endYear,
                songCount: songCount
            })
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
        showAlert('error made while contact with server');
    }
}

function renderSongs(songs) {
    const mood = document.getElementById('moodInput').value;
    const resultsDiv = document.getElementById('results');
    
    if (!songs || songs.length === 0) return;

    const ul = document.createElement('ul');
    songs.forEach(song => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${song.track}</strong> - ${song.artist}`;
        ul.appendChild(li);
    });
    resultsDiv.appendChild(ul);

    const nameLabel = document.createElement('label');
    nameLabel.innerText = "Playlist Name:";
    nameLabel.className = 'playlist-name-label'; // שימוש ב-class
    resultsDiv.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = "text";
    nameInput.id = "playlistNameInput";
    nameInput.value = `AI Mood: ${mood}`;
    nameInput.className = 'playlist-name-input'; // שימוש ב-class
    resultsDiv.appendChild(nameInput);

    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'SAVE TO SPOTIFY 💾';
    saveBtn.className = 'save-spotify-btn'; // שימוש ב-class שמטפל גם ב-hover
    saveBtn.onclick = saveToSpotify; 
    
    resultsDiv.appendChild(saveBtn);
}

async function saveToSpotify() {
        const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) return; 

    const mood = document.getElementById('moodInput').value;
    const saveBtn = document.querySelector('#results button'); 
    const playlistNameInput = document.getElementById('playlistNameInput');
    
    const playlistName = playlistNameInput ? playlistNameInput.value : `AI Mood: ${mood}`;
    
    if (!songsArr){  
        showAlert('cannot find those songs');
        return
    }
    saveBtn.disabled = true;
    saveBtn.innerText = 'saving... ⏳';

    try {
        const response = await fetch('/save-playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs: songsArr, mood: mood, playlistName: playlistName })
        });

        const data = await response.json();

        if (data.success) {
            saveBtn.innerText = 'saved successfully! ✅';
            
            const resultsDiv = document.getElementById('results');
            
            window.location.href = `/playMusic?id=${data.playlistId}&url=${encodeURIComponent(data.playlistUrl)}`;
            
        } else {
            showAlert('error: ' + (data.error || 'could not save your playlist'));
            saveBtn.innerText = 'try again ❌';
            saveBtn.disabled = false;
        }

    } catch (error) {
        console.error('Save Error:', error);
        showAlert('connection error');
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