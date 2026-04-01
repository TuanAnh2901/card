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

let audio = new Audio();
let currentSong = 0;
let isPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
    loadSong(currentSong);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', nextSong);
    audio.addEventListener('loadedmetadata', () => {
        musicDuration.textContent = formatTime(audio.duration);
    });
    musicPrevBtn.addEventListener('click', prevSong);
    musicNextBtn.addEventListener('click', nextSong);
    musicPlayBtn.addEventListener('click', togglePlayPause);
    musicProgressBar.addEventListener('click', seek);
    musicVolumeSlider.addEventListener('input', setVolume);
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
}

function prevSong() {
    currentSong = (currentSong - 1 + songsList.length) % songsList.length;
    playMusic();
}

function playMusic() {
    loadSong(currentSong);
    audio.play();
    isPlaying = true;
    musicPlayBtn.classList.add('fa-pause');
    musicPlayBtn.classList.remove('fa-play');
    musicCover.classList.add('playing');
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
