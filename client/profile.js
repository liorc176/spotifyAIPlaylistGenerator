let currentOffset = 0;
const limit = 3; 

document.addEventListener('DOMContentLoaded', () => {
    loadProfileName();
    loadStats();
    loadPlaylists();
});

async function loadProfileName() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        
        if (data.authenticated) {
            document.getElementById('profileNameDisplay').innerText = `${data.user}'s`;
        } else {
            window.location.href = '/login'; 
        }
    } catch (err) {
        console.error('Error fetching auth status:', err);
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/user/stats');
        const stats = await response.json();

        if (stats.error) return;

        document.getElementById('statTotal').innerText = stats.totalPlaylists;
        
        document.getElementById('statMood').innerText = stats.topMood;
        document.getElementById('statMoodCount').innerText = `${stats.topMoodCount} times`;

        document.getElementById('statGenre').innerText = stats.topGenre;
        document.getElementById('statGenreCount').innerText = `${stats.topGenreCount} times`;

        document.getElementById('statArtist').innerText = stats.topArtist;
        document.getElementById('statArtistCount').innerText = `${stats.topArtistCount} times`;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadPlaylists() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    loadMoreBtn.innerText = 'Loading... ⏳';
    loadMoreBtn.disabled = true;

    try {
        const response = await fetch(`/api/user/playlists?limit=${limit}&offset=${currentOffset}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const grid = document.getElementById('playlistsGrid');

        if (data.playlists.length === 0 && currentOffset === 0) {
            grid.innerHTML = '<p style="color: #b3b3b3; grid-column: 1 / -1;">You haven\'t created any playlists yet. Go generate some music!</p>';
            loadMoreBtn.style.display = 'none';
            return;
        }

        data.playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'playlist-card';

            const iframe = document.createElement('iframe');
            iframe.className = 'compact-player';
            iframe.src = `https://open.spotify.com/embed/playlist/${playlist.spotify_playlist_id}?utm_source=generator`;
            iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            iframe.loading = "lazy"; 

            const fullPlayerLink = document.createElement('a');
            fullPlayerLink.className = 'full-player-btn';
            fullPlayerLink.innerText = 'Open Full Player 🎧';
            fullPlayerLink.href = `/playMusic?id=${playlist.spotify_playlist_id}&url=${encodeURIComponent(playlist.spotify_url)}`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'playlist-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit-btn';
            editBtn.innerText = '✏️ Rename';
            editBtn.onclick = () => openRenameModal(playlist.id, playlist.spotify_playlist_id, playlist.playlist_name);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete-btn';
            deleteBtn.innerText = '🗑️ Delete';
            deleteBtn.onclick = () => openDeleteModal(playlist.id, playlist.spotify_playlist_id);

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn)

            card.appendChild(iframe);
            card.appendChild(fullPlayerLink);
            card.appendChild(actionsDiv);
            grid.appendChild(card);
        });

        currentOffset += data.playlists.length;

        if (data.hasMore) {
            loadMoreBtn.style.display = 'inline-block';
            loadMoreBtn.innerText = 'Load More 👇';
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.style.display = 'none'; 
        }

    } catch (error) {
        console.error('Error loading playlists:', error);
        loadMoreBtn.innerText = 'Error loading. Try again.';
        loadMoreBtn.disabled = false;
    }
}


function openRenameModal(dbId, spotifyId, currentName) {
    document.getElementById('editDbId').value = dbId;
    document.getElementById('editPlaylistId').value = spotifyId;
    document.getElementById('newPlaylistName').value = currentName; 
    document.getElementById('renameModal').style.display = 'flex';
}

function closeRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
}

async function submitRename() {
    const dbId = document.getElementById('editDbId').value;
    const spotifyId = document.getElementById('editPlaylistId').value;
    const newName = document.getElementById('newPlaylistName').value;

    if (!newName.trim()) return alert("Name cannot be empty");

    try {
        const res = await fetch(`/api/user/playlist/${dbId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotifyPlaylistId: spotifyId, newName: newName })
        });
        const data = await res.json();
        
        if (data.success) {
            closeRenameModal();
            location.reload(); 
        } else {
            alert(data.error || "Failed to rename");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error");
    }
}

function openDeleteModal(dbId, spotifyId) {
    document.getElementById('deleteDbId').value = dbId;
    document.getElementById('deletePlaylistId').value = spotifyId;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

async function submitDelete(deleteType) {
    const dbId = document.getElementById('deleteDbId').value;
    const spotifyId = document.getElementById('deletePlaylistId').value;

    try {
        const res = await fetch(`/api/user/playlist/${dbId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotifyPlaylistId: spotifyId, deleteType: deleteType })
        });
        const data = await res.json();
        
        if (data.success) {
            closeDeleteModal();
            location.reload(); 
        } else {
            alert(data.error || "Failed to delete");
        }
    } catch (err) {
        console.error(err);
        alert("Connection error");
    }
}