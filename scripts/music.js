const songsList = [
    {
        name: "THERE'S NO ONE AT ALL",
        artist: "Sơn Tùng M-TP",
        src: "./public/musics/song1.mp3",
        cover: "./public/musics/cover1.png"
    },
    {
        name: "Santa Claus is coming by train",
        artist: "Sharou",
        src: "./public/musics/song2.mp3",
        cover: "./public/musics/cover1.png"
    },
    {
        name: "Bunny Girl Senpai Lofi",
        artist: "Okayu",
        src: "./public/musics/bunnygirlsenpai_okayu.mp3",
        cover: "./public/musics/cover1.png"
    }
    // {
    //     name: "Sample Song 3",
    //     artist: "Artist 3",
    //     src: "./public/musics/song3.mp3",
    //     cover: "./public/musics/cover3.jpg"
    // }
];

const musicTitle = document.getElementById('music-title');
const musicArtist = document.getElementById('music-artist');
const musicCover = document.getElementById('music-cover');
const musicPlayBtn = document.getElementById('music-play');
const musicPrevBtn = document.getElementById('music-prev');
const musicNextBtn = document.getElementById('music-next');
const musicProgressBar = document.getElementById('music-progress-bar');
const musicProgressFill = document.getElementById('music-progress-fill');
const musicCurrentTime = document.getElementById('music-current-time');
const musicDuration = document.getElementById('music-duration');
const musicVolumeSlider = document.getElementById('music-volume-slider');
const musicRepeatOneBtn = document.getElementById('music-repeat-one');
const musicPlaylistToggle = document.getElementById('music-playlist-toggle');
const musicPlaylistEl = document.getElementById('music-playlist');

let audio = new Audio();
let currentSong = 0;
let isPlaying = false;
let isRepeatOne = false;

document.addEventListener('DOMContentLoaded', () => {
    loadSong(currentSong);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleSongEnd);
    audio.addEventListener('loadedmetadata', () => {
        musicDuration.textContent = formatTime(audio.duration);
    });
    musicPrevBtn.addEventListener('click', prevSong);
    musicNextBtn.addEventListener('click', nextSong);
    musicPlayBtn.addEventListener('click', togglePlayPause);
    musicProgressBar.addEventListener('click', seek);
    musicVolumeSlider.addEventListener('input', setVolume);
    musicRepeatOneBtn.addEventListener('click', toggleRepeatOne);
    musicPlaylistToggle.addEventListener('click', togglePlaylist);
    renderPlaylist();
    preloadDurations();
    audio.volume = 0.5;
});

function loadSong(index) {
    const { name, artist, src, cover } = songsList[index];
    musicTitle.textContent = name;
    musicArtist.textContent = artist;
    audio.src = src;
    if (cover) {
        musicCover.style.backgroundImage = `url(${cover})`;
    } else {
        musicCover.style.backgroundImage = 'none';
    }
}

function updateProgress() {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        musicProgressFill.style.width = `${percent}%`;
        musicCurrentTime.textContent = formatTime(audio.currentTime);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function togglePlayPause() {
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
    musicPlayBtn.classList.toggle('fa-pause', isPlaying);
    musicPlayBtn.classList.toggle('fa-play', !isPlaying);
    musicCover.classList.toggle('playing', isPlaying);
}

function nextSong() {
    currentSong = (currentSong + 1) % songsList.length;
    playMusic();
    updatePlaylistActive();
}

function prevSong() {
    currentSong = (currentSong - 1 + songsList.length) % songsList.length;
    playMusic();
    updatePlaylistActive();
}

function playMusic() {
    loadSong(currentSong);
    audio.play();
    isPlaying = true;
    musicPlayBtn.classList.add('fa-pause');
    musicPlayBtn.classList.remove('fa-play');
    musicCover.classList.add('playing');
    updatePlaylistActive();
}

function seek(e) {
    const width = musicProgressBar.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    audio.currentTime = (clickX / width) * duration;
}

function setVolume() {
    audio.volume = musicVolumeSlider.value;
}

function toggleRepeatOne() {
    isRepeatOne = !isRepeatOne;
    musicRepeatOneBtn.classList.toggle('active', isRepeatOne);
}

function handleSongEnd() {
    if (isRepeatOne) {
        playMusic();
    } else {
        nextSong();
    }
}

function togglePlaylist() {
    musicPlaylistEl.classList.toggle('open');
    musicPlaylistToggle.classList.toggle('active');
}

function renderPlaylist() {
    musicPlaylistEl.innerHTML = songsList.map((song, i) => `
        <div class="music-playlist-item${i === currentSong ? ' active' : ''}" data-index="${i}">
            <div class="music-playlist-cover" style="background-image: url('${song.cover || ''}')"></div>
            <div class="music-playlist-info">
                <div class="music-playlist-name">${song.name}</div>
                <div class="music-playlist-artist">${song.artist}</div>
            </div>
            <div class="music-playlist-duration" data-duration-index="${i}">--:--</div>
        </div>
    `).join('');
    musicPlaylistEl.querySelectorAll('.music-playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index, 10);
            if (index !== currentSong) {
                currentSong = index;
                playMusic();
            } else {
                togglePlayPause();
            }
            updatePlaylistActive();
        });
    });
}

function updatePlaylistActive() {
    musicPlaylistEl.querySelectorAll('.music-playlist-item').forEach((item, i) => {
        item.classList.toggle('active', i === currentSong);
    });
}

function preloadDurations() {
    songsList.forEach((song, i) => {
        const tempAudio = new Audio();
        tempAudio.preload = 'metadata';
        tempAudio.src = song.src;
        tempAudio.addEventListener('loadedmetadata', () => {
            const el = musicPlaylistEl.querySelector(`[data-duration-index="${i}"]`);
            if (el) el.textContent = formatTime(tempAudio.duration);
        });
    });
}
