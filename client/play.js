
        const params = new URLSearchParams(window.location.search);
        const playlistId = params.get('id');
        const playlistUrl = params.get('url');
        async function loadProfileName() {
            try {
                const response = await fetch('/check-auth');
                const data = await response.json();
                
                if (data.authenticated) {
                    document.getElementById('profileName').innerText = data.user;
                }
            } catch (err) {
                console.error('Error fetching auth status:', err);
            }
        }
        
        loadProfileName();
        if (playlistId) {
            const iframe = document.createElement('iframe');
            iframe.className = "spotify-player";
            iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`;
            iframe.allowFullscreen = "";
            iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
            iframe.loading = "lazy";
            
            document.getElementById('playerWrapper').appendChild(iframe);
        }

        if (playlistUrl && playlistUrl.startsWith('https://open.spotify.com/')) {
            document.getElementById('spotifyLink').href = playlistUrl;
            setupShareButtons(playlistUrl);
        } else if (playlistUrl) {
            document.getElementById('spotifyLink').style.display = 'none';
            const shareContainer = document.querySelector('.share-container');
            if (shareContainer) {
                shareContainer.style.display = 'none';
            }           
            console.error('Blocked an invalid or malicious Spotify URL');
        }
        
        function setupShareButtons(playlistUrl) {
            const message ='I created a new playlist using SpotifyAIPlaylistGenerator. Come try it out:';
            const encodedMsg = encodeURIComponent(message + " " + playlistUrl);
            const encodedUrl = encodeURIComponent(playlistUrl);

            const whatsappBtn = document.getElementById('share-whatsapp');
            if (whatsappBtn) whatsappBtn.href = `https://wa.me/?text=${encodedMsg}`;

            const facebookBtn = document.getElementById('share-facebook');
            if (facebookBtn) facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

            const linkedinBtn = document.getElementById('share-linkedin');
            if (linkedinBtn) linkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        }