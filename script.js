// ==================== SUPABASE CLIENT SETUP ====================
const SUPABASE_URL = 'https://bxhrnnwfqlsoviysqcdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aHJubndmcWxzb3ZpeXNxY2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODkzNDIsImV4cCI6MjA4MTM2NTM0Mn0.O7fpv0TrDd-8ZE3Z9B5zWyAuWROPis5GRnKMxmqncX8';

// Create Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        headers: {
            'apikey': SUPABASE_ANON_KEY
        }
    }
});

// ==================== UTILITY FUNCTIONS ====================
function showLoading(show = true) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#00ff00';
            notification.style.color = '#000000';
            break;
        case 'error':
            notification.style.backgroundColor = '#ff0000';
            notification.style.color = '#ffffff';
            break;
        default:
            notification.style.backgroundColor = '#000000';
            notification.style.color = '#ffffff';
    }
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function sanitizeFilename(filename) {
    // Remove path and keep only filename
    const name = filename.split('\\').pop().split('/').pop();
    // Replace special characters and spaces
    return name
        .replace(/[^a-zA-Z0-9.]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .substring(0, 100);
}

async function getAudioDuration(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        
        audio.onloadedmetadata = function() {
            URL.revokeObjectURL(audio.src);
            resolve(Math.round(audio.duration));
        };
        
        audio.onerror = function() {
            URL.revokeObjectURL(audio.src);
            resolve(180); // Default 3 minutes
        };
        
        const objectUrl = URL.createObjectURL(file);
        audio.src = objectUrl;
    });
}

// ==================== THEME TOGGLE ====================
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    
    // Check saved theme
    const savedTheme = localStorage.getItem('oraplyTheme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
        themeIcon.className = 'fas fa-sun';
    } else {
        document.documentElement.classList.remove('light-mode');
        themeIcon.className = 'fas fa-moon';
    }
    
    // Toggle theme
    themeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('light-mode')) {
            document.documentElement.classList.remove('light-mode');
            themeIcon.className = 'fas fa-moon';
            localStorage.setItem('oraplyTheme', 'dark');
        } else {
            document.documentElement.classList.add('light-mode');
            themeIcon.className = 'fas fa-sun';
            localStorage.setItem('oraplyTheme', 'light');
        }
    });
}

// ==================== STATE MANAGEMENT ====================
let currentUser = null;
let currentSection = 'home';
let currentAdminSection = 'manage-artists';
let currentSongIndex = 0;
let currentPlaylist = [];
let isPlaying = false;
let audioPlayer = new Audio();

// Navigation history
let navigationHistory = {
    section: 'home',
    data: null
};

// ==================== DOM ELEMENTS ====================
const landingPage = document.getElementById('landing-page');
const authModal = document.getElementById('auth-modal');
const mainApp = document.getElementById('main-app');
const adminDashboard = document.getElementById('admin-dashboard');
const musicPlayer = document.getElementById('music-player');
const mainContent = document.getElementById('main-content');
const backBtn = document.getElementById('back-btn');
const adminBackBtn = document.getElementById('admin-back-btn');

// Auth elements
const loginBtn = document.getElementById('login-btn');
const closeAuthBtn = document.getElementById('close-auth');
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Main app elements
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const navItems = document.querySelectorAll('.nav-item');

// Player elements
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const currentTimeSpan = document.getElementById('current-time');
const totalTimeSpan = document.getElementById('total-time');

// Admin elements
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const adminNavItems = document.querySelectorAll('.admin-nav .nav-item');
const adminSections = document.querySelectorAll('.admin-section');

// Admin forms
const addArtistForm = document.getElementById('add-artist-form');
const addAlbumForm = document.getElementById('add-album-form');
const addSongForm = document.getElementById('add-song-form');
const addGenreForm = document.getElementById('add-genre-form');

// ==================== FILE UPLOAD HANDLERS ====================
document.getElementById('artist-image-upload').addEventListener('click', () => {
    document.getElementById('artist-image').click();
});

document.getElementById('album-cover-upload').addEventListener('click', () => {
    document.getElementById('album-cover').click();
});

document.getElementById('song-cover-upload').addEventListener('click', () => {
    document.getElementById('song-cover').click();
});

document.getElementById('song-files-upload').addEventListener('click', () => {
    document.getElementById('song-files').click();
});

// Handle image preview for artist
document.getElementById('artist-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File terlalu besar! Maksimal 5MB.', 'error');
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const preview = document.getElementById('artist-preview');
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Handle image preview for album
document.getElementById('album-cover').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File terlalu besar! Maksimal 5MB.', 'error');
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const preview = document.getElementById('album-preview');
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Handle cover image for song
document.getElementById('song-cover').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File terlalu besar! Maksimal 5MB.', 'error');
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const preview = document.getElementById('song-cover-preview');
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Handle multiple song files
document.getElementById('song-files').addEventListener('change', function(e) {
    const files = e.target.files;
    const fileList = document.getElementById('song-files-list');
    fileList.innerHTML = '';
    
    // Check total size
    let totalSize = 0;
    for (let file of files) {
        totalSize += file.size;
    }
    
    if (totalSize > 50 * 1024 * 1024) { // 50MB max
        showNotification('Total file terlalu besar! Maksimal 50MB.', 'error');
        this.value = '';
        return;
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 10 * 1024 * 1024) { // 10MB per file
            showNotification(`File ${file.name} terlalu besar! Maksimal 10MB per file.`, 'error');
            continue;
        }
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            <i class="fas fa-times" onclick="this.parentElement.remove()"></i>
        `;
        fileList.appendChild(fileItem);
    }
});

// ==================== BACK BUTTON HANDLERS ====================
backBtn.addEventListener('click', () => {
    if (navigationHistory.data) {
        // Restore previous state
        currentSection = navigationHistory.section;
        const data = navigationHistory.data;
        
        // Reset navigation history
        navigationHistory = { section: 'home', data: null };
        backBtn.style.display = 'none';
        
        // Reload content based on previous state
        loadContent();
    }
});

adminBackBtn.addEventListener('click', () => {
    // In admin mode, just go back to first section
    currentAdminSection = 'manage-artists';
    adminNavItems.forEach(i => i.classList.remove('active'));
    adminNavItems[0].classList.add('active');
    
    adminSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === currentAdminSection) {
            section.classList.add('active');
        }
    });
    
    adminBackBtn.style.display = 'none';
    loadAdminData();
});

// ==================== DATA LOADING FUNCTIONS ====================
async function loadArtistsForDropdowns() {
    try {
        const { data: artists, error } = await supabaseClient
            .from('artists_oraplay')
            .select('id, name')
            .order('name', { ascending: true });
        
        if (error) {
            console.error('Error loading artists:', error);
            return;
        }
        
        // Update all artist dropdowns
        const artistSelects = document.querySelectorAll('select[id$="artist"]');
        
        artistSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Pilih Artis</option>';
            
            if (artists && artists.length > 0) {
                artists.forEach(artist => {
                    const option = document.createElement('option');
                    option.value = artist.id;
                    option.textContent = artist.name;
                    select.appendChild(option);
                });
                
                // Restore previous selection if any
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        });
        
    } catch (error) {
        console.error('Error in loadArtistsForDropdowns:', error);
    }
}

async function loadAlbumsForDropdowns() {
    try {
        const { data: albums, error } = await supabaseClient
            .from('albums_oraplay')
            .select('id, title')
            .order('title', { ascending: true });
        
        if (!error && albums) {
            const albumSelect = document.getElementById('song-album');
            if (albumSelect) {
                const currentValue = albumSelect.value;
                albumSelect.innerHTML = '<option value="">Pilih Album (Opsional)</option>';
                
                albums.forEach(album => {
                    const option = document.createElement('option');
                    option.value = album.id;
                    option.textContent = album.title;
                    albumSelect.appendChild(option);
                });
                
                if (currentValue) {
                    albumSelect.value = currentValue;
                }
            }
        }
    } catch (error) {
        console.error('Error loading albums:', error);
    }
}

async function loadGenresForDropdowns() {
    try {
        const { data: genres, error } = await supabaseClient
            .from('genres_oraplay')
            .select('id, name')
            .order('name', { ascending: true });
        
        if (!error && genres) {
            const genreSelects = document.querySelectorAll('select[id$="genre-select"]');
            
            genreSelects.forEach(select => {
                const currentValue = select.value;
                select.innerHTML = '<option value="">Pilih Genre</option>';
                
                genres.forEach(genre => {
                    const option = document.createElement('option');
                    option.value = genre.id;
                    option.textContent = genre.name;
                    select.appendChild(option);
                });
                
                if (currentValue) {
                    select.value = currentValue;
                }
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

async function loadGenresForTags() {
    try {
        const { data: genres, error } = await supabaseClient
            .from('genres_oraplay')
            .select('id, name, color')
            .order('name', { ascending: true });
        
        if (!error && genres) {
            const genreTagsContainer = document.getElementById('artist-genre-tags');
            if (genreTagsContainer) {
                genreTagsContainer.innerHTML = '';
                
                genres.forEach(genre => {
                    const tag = document.createElement('div');
                    tag.className = 'genre-tag';
                    tag.textContent = genre.name;
                    tag.style.backgroundColor = genre.color;
                    tag.style.color = '#000000';
                    
                    tag.addEventListener('click', function() {
                        document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
                        this.classList.add('active');
                        document.getElementById('artist-genre').value = genre.id;
                    });
                    
                    genreTagsContainer.appendChild(tag);
                });
            }
        }
    } catch (error) {
        console.error('Error loading genres for tags:', error);
    }
}

// ==================== AUTH FUNCTIONS ====================
loginBtn.addEventListener('click', () => {
    authModal.style.display = 'flex';
});

closeAuthBtn.addEventListener('click', () => {
    authModal.style.display = 'none';
});

// Switch between login and register tabs
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const formId = tab.getAttribute('data-form');
        
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === formId) {
                form.classList.add('active');
            }
        });
    });
});

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    showLoading(true);
    
    try {
        // Check if admin
        if (username === 'admin' && password === 'RANTAUPRAPAT123') {
            currentUser = { 
                username: 'admin', 
                isAdmin: true,
                id: 'admin'
            };
            localStorage.setItem('oraplyCurrentUser', JSON.stringify(currentUser));
            showAdminDashboard();
            authModal.style.display = 'none';
            showNotification('Login sebagai admin berhasil!', 'success');
            return;
        }
        
        // Check users from Supabase
        const { data, error } = await supabaseClient
            .from('users_oraplay')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();
        
        if (error || !data) {
            showNotification('Username atau password salah!', 'error');
        } else {
            currentUser = {
                id: data.id,
                username: data.username,
                isAdmin: data.is_admin || false
            };
            localStorage.setItem('oraplyCurrentUser', JSON.stringify(currentUser));
            showMainApp();
            authModal.style.display = 'none';
            showNotification('Login berhasil!', 'success');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Error koneksi database!', 'error');
    } finally {
        showLoading(false);
    }
});

// Handle registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    if (password !== confirmPassword) {
        showNotification('Password tidak cocok!', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Check if username already exists
        const { data: existingUsers, error: checkError } = await supabaseClient
            .from('users_oraplay')
            .select('username')
            .eq('username', username);
        
        if (checkError) {
            showNotification('Error cek username!', 'error');
            return;
        }
        
        if (existingUsers && existingUsers.length > 0) {
            showNotification('Username sudah digunakan!', 'error');
            return;
        }
        
        // Add new user to Supabase
        const { data, error } = await supabaseClient
            .from('users_oraplay')
            .insert([
                {
                    username: username,
                    password: password,
                    is_admin: false,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            showNotification('Error pendaftaran!', 'error');
        } else {
            showNotification('Pendaftaran berhasil! Silakan login.', 'success');
            // Switch to login tab
            authTabs[0].click();
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = '';
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Error koneksi database!', 'error');
    } finally {
        showLoading(false);
    }
});

// Handle logout
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('oraplyCurrentUser');
    showLandingPage();
    showNotification('Logout berhasil!', 'success');
});

// Admin logout
adminLogoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('oraplyCurrentUser');
    showLandingPage();
    showNotification('Logout berhasil!', 'success');
});

// ==================== NAVIGATION ====================
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.remove('active');
        item.classList.add('active');
        currentSection = item.getAttribute('data-section');
        
        // Reset navigation history
        navigationHistory = { section: 'home', data: null };
        backBtn.style.display = 'none';
        
        loadContent();
    });
});

adminNavItems.forEach(item => {
    item.addEventListener('click', () => {
        adminNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        currentAdminSection = item.getAttribute('data-admin-section');
        
        adminSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === currentAdminSection) {
                section.classList.add('active');
            }
        });
        
        // Load data for the selected section
        if (currentAdminSection === 'manage-artists') {
            loadGenresForTags();
        } else if (currentAdminSection === 'manage-albums') {
            loadArtistsForDropdowns();
            loadGenresForDropdowns();
        } else if (currentAdminSection === 'manage-songs') {
            loadArtistsForDropdowns();
            loadAlbumsForDropdowns();
            loadGenresForDropdowns();
        }
        
        // Load admin data
        loadAdminData();
    });
});

// ==================== PLAYER FUNCTIONS ====================
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', playPrevSong);
nextBtn.addEventListener('click', playNextSong);

// Progress bar click
progressContainer.addEventListener('click', (e) => {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    
    if (duration) {
        audioPlayer.currentTime = (clickX / width) * duration;
    }
});

// Update progress bar and time
audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBar.style.width = `${progress}%`;
        
        currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
        totalTimeSpan.textContent = formatTime(audioPlayer.duration);
    }
});

// Audio ended
audioPlayer.addEventListener('ended', () => {
    playNextSong();
});

// ==================== ADMIN FORM SUBMISSIONS ====================
addArtistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('artist-name').value;
    const country = document.getElementById('artist-country').value;
    const bio = document.getElementById('artist-bio').value;
    const genreId = document.getElementById('artist-genre').value;
    
    if (!genreId) {
        showNotification('Pilih genre untuk artis!', 'error');
        return;
    }
    
    showLoading(true);
    
    // Handle image upload
    const imageInput = document.getElementById('artist-image');
    let imageUrl = null;
    
    if (imageInput.files.length > 0) {
        const file = imageInput.files[0];
        const safeFileName = sanitizeFilename(file.name);
        const fileName = `artist_${Date.now()}_${safeFileName}`;
        
        try {
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('oraplay_images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL
            const { data: urlData } = supabaseClient
                .storage
                .from('oraplay_images')
                .getPublicUrl(fileName);
            
            imageUrl = urlData.publicUrl;
        } catch (error) {
            console.error('Image upload error:', error);
            showNotification('Error upload gambar!', 'error');
            showLoading(false);
            return;
        }
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('artists_oraplay')
            .insert([
                {
                    name: name,
                    country: country,
                    bio: bio,
                    genre_id: genreId,
                    image_url: imageUrl,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        showNotification('Artis berhasil ditambahkan!', 'success');
        addArtistForm.reset();
        document.getElementById('artist-preview').innerHTML = '';
        document.getElementById('artist-preview').style.display = 'none';
        document.getElementById('artist-genre').value = '';
        
        // Clear active genre tag
        document.querySelectorAll('.genre-tag.active').forEach(tag => {
            tag.classList.remove('active');
        });
        
        // Reload data
        loadAdminData();
        loadArtistsForDropdowns();
        
    } catch (error) {
        console.error('Error saving artist:', error);
        showNotification('Error menyimpan artis!', 'error');
    } finally {
        showLoading(false);
    }
});

addAlbumForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('album-title').value;
    const artistId = document.getElementById('album-artist').value;
    const year = document.getElementById('album-year').value;
    const genreId = document.getElementById('album-genre-select').value;
    
    if (!artistId) {
        showNotification('Pilih artis untuk album!', 'error');
        return;
    }
    
    if (!genreId) {
        showNotification('Pilih genre untuk album!', 'error');
        return;
    }
    
    showLoading(true);
    
    // Handle image upload
    const imageInput = document.getElementById('album-cover');
    let imageUrl = null;
    
    if (imageInput.files.length > 0) {
        const file = imageInput.files[0];
        const safeFileName = sanitizeFilename(file.name);
        const fileName = `album_${Date.now()}_${safeFileName}`;
        
        try {
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('oraplay_images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL
            const { data: urlData } = supabaseClient
                .storage
                .from('oraplay_images')
                .getPublicUrl(fileName);
            
            imageUrl = urlData.publicUrl;
        } catch (error) {
            console.error('Image upload error:', error);
            showNotification('Error upload gambar!', 'error');
            showLoading(false);
            return;
        }
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('albums_oraplay')
            .insert([
                {
                    title: title,
                    artist_id: artistId,
                    year: parseInt(year),
                    genre_id: genreId,
                    cover_url: imageUrl,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        showNotification('Album berhasil ditambahkan!', 'success');
        addAlbumForm.reset();
        document.getElementById('album-preview').innerHTML = '';
        document.getElementById('album-preview').style.display = 'none';
        
        // Reload data
        loadAdminData();
        loadAlbumsForDropdowns();
        
    } catch (error) {
        console.error('Error saving album:', error);
        showNotification('Error menyimpan album!', 'error');
    } finally {
        showLoading(false);
    }
});

addSongForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('song-title').value;
    const artistId = document.getElementById('song-artist').value;
    const albumId = document.getElementById('song-album').value;
    const genreId = document.getElementById('song-genre-select').value;
    
    // Validation
    if (!title.trim()) {
        showNotification('Judul lagu harus diisi!', 'error');
        return;
    }
    
    if (!artistId) {
        showNotification('Pilih artis untuk lagu!', 'error');
        return;
    }
    
    if (!genreId) {
        showNotification('Pilih genre untuk lagu!', 'error');
        return;
    }
    
    const filesInput = document.getElementById('song-files');
    
    if (filesInput.files.length === 0) {
        showNotification('Pilih file lagu!', 'error');
        return;
    }
    
    showLoading(true);
    
    // Handle cover image upload
    const coverInput = document.getElementById('song-cover');
    let coverUrl = null;
    
    if (coverInput.files.length > 0) {
        const file = coverInput.files[0];
        const safeFileName = sanitizeFilename(file.name);
        const fileName = `song_cover_${Date.now()}_${safeFileName}`;
        
        try {
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('oraplay_images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                throw uploadError;
            }
            
            // Get public URL
            const { data: urlData } = supabaseClient
                .storage
                .from('oraplay_images')
                .getPublicUrl(fileName);
            
            coverUrl = urlData.publicUrl;
        } catch (error) {
            console.error('Cover upload error:', error);
            // Continue without cover
        }
    }
    
    let uploadedCount = 0;
    const totalFiles = filesInput.files.length;
    
    // Process each file
    for (let i = 0; i < filesInput.files.length; i++) {
        const file = filesInput.files[i];
        
        // Skip if file is too large
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`File ${file.name} terlalu besar (max 10MB)`, 'error');
            continue;
        }
        
        try {
            // Generate safe filename
            const safeFileName = sanitizeFilename(file.name);
            const fileName = `song_${Date.now()}_${i}_${safeFileName}`;
            
            // Get duration
            const duration = await getAudioDuration(file);
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('oraplay_audio')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Upload error:', uploadError);
                showNotification(`Error upload ${file.name}`, 'error');
                continue;
            }
            
            // Get public URL
            const { data: urlData } = supabaseClient
                .storage
                .from('oraplay_audio')
                .getPublicUrl(fileName);
            
            const audioUrl = urlData.publicUrl;
            
            // Determine song title
            const songTitle = totalFiles === 1 ? title : `${title} - Part ${i + 1}`;
            
            // Save to database
            const { data, error: dbError } = await supabaseClient
                .from('songs_oraplay')
                .insert([
                    {
                        title: songTitle,
                        artist_id: artistId,
                        album_id: albumId || null,
                        genre_id: genreId,
                        audio_url: audioUrl,
                        cover_url: coverUrl,
                        duration: duration,
                        file_name: safeFileName,
                        file_size: file.size,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();
            
            if (dbError) {
                console.error('Database error:', dbError);
                showNotification(`Error menyimpan ${file.name}`, 'error');
            } else {
                uploadedCount++;
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
            showNotification(`Error memproses ${file.name}`, 'error');
        }
    }
    
    showLoading(false);
    
    // Show final result
    if (uploadedCount > 0) {
        showNotification(`${uploadedCount} lagu berhasil ditambahkan!`, 'success');
        addSongForm.reset();
        document.getElementById('song-files-list').innerHTML = '';
        document.getElementById('song-cover-preview').innerHTML = '';
        document.getElementById('song-cover-preview').style.display = 'none';
        loadAdminData();
    } else {
        showNotification('Tidak ada lagu yang berhasil diupload', 'error');
    }
});

addGenreForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('genre-name').value;
    const color = document.getElementById('genre-color').value;
    
    if (!name.trim()) {
        showNotification('Nama genre harus diisi!', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const { data, error } = await supabaseClient
            .from('genres_oraplay')
            .insert([
                {
                    name: name,
                    color: color,
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        showNotification('Genre berhasil ditambahkan!', 'success');
        addGenreForm.reset();
        
        // Reload data
        loadAdminData();
        loadGenresForDropdowns();
        loadGenresForTags();
        
    } catch (error) {
        console.error('Error saving genre:', error);
        showNotification('Error menyimpan genre!', 'error');
    } finally {
        showLoading(false);
    }
});

// ==================== PAGE VIEW FUNCTIONS ====================
function showLandingPage() {
    landingPage.style.display = 'flex';
    mainApp.style.display = 'none';
    adminDashboard.style.display = 'none';
    musicPlayer.style.display = 'none';
    audioPlayer.pause();
}

function showMainApp() {
    landingPage.style.display = 'none';
    mainApp.style.display = 'block';
    adminDashboard.style.display = 'none';
    
    if (currentUser) {
        currentUserSpan.textContent = currentUser.username;
    }
    
    loadContent();
}

function showAdminDashboard() {
    landingPage.style.display = 'none';
    mainApp.style.display = 'none';
    adminDashboard.style.display = 'block';
    
    // Load initial data
    loadGenresForTags();
    loadArtistsForDropdowns();
    loadAlbumsForDropdowns();
    loadGenresForDropdowns();
    loadAdminData();
}

// ==================== DETAIL VIEW FUNCTIONS ====================
async function showArtistDetail(artistId) {
    showLoading(true);
    
    try {
        // Get artist details
        const { data: artist, error: artistError } = await supabaseClient
            .from('artists_oraplay')
            .select('*')
            .eq('id', artistId)
            .single();
        
        if (artistError || !artist) {
            showNotification('Artis tidak ditemukan!', 'error');
            showLoading(false);
            return;
        }
        
        // Get artist's songs
        const { data: songs, error: songsError } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .eq('artist_id', artistId);
        
        // Get artist's albums
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums_oraplay')
            .select('*')
            .eq('artist_id', artistId);
        
        // Get genre name
        let genreName = 'Unknown Genre';
        if (artist.genre_id) {
            const { data: genre } = await supabaseClient
                .from('genres_oraplay')
                .select('name')
                .eq('id', artist.genre_id)
                .single();
            if (genre) genreName = genre.name;
        }
        
        let contentHTML = `
            <div class="card-details">
                <div class="detail-header">
                    <div class="detail-img">
                        ${artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="detail-info">
                        <h1 class="detail-name">${artist.name}</h1>
                        <div class="detail-meta">
                            <p>${artist.country} • ${genreName}</p>
                            <p>${songs ? songs.length : 0} Lagu • ${albums ? albums.length : 0} Album</p>
                        </div>
                        <div class="detail-description">
                            <p>${artist.bio || 'Tidak ada biografi tersedia.'}</p>
                        </div>
                    </div>
                </div>
        `;
        
        // Show albums
        if (albums && albums.length > 0) {
            contentHTML += `
                <h3 class="section-title">ALBUM (${albums.length})</h3>
                <div class="home-grid">
            `;
            
            for (const album of albums) {
                contentHTML += `
                    <div class="card" onclick="showAlbumDetail('${album.id}')">
                        <div class="card-img">
                            ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                        </div>
                        <div class="card-title">${album.title}</div>
                        <div class="card-subtitle">${album.year}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        // Show songs
        if (songs && songs.length > 0) {
            contentHTML += `
                <h3 class="section-title">LAGU (${songs.length})</h3>
                <div class="home-grid">
            `;
            
            for (const song of songs) {
                contentHTML += `
                    <div class="card" data-song-id="${song.id}">
                        <div class="card-img">
                            ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : 
                              (artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-music"></i>')}
                        </div>
                        <div class="card-title">${song.title}</div>
                        <div class="card-subtitle">${formatTime(song.duration)}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        contentHTML += '</div>';
        mainContent.innerHTML = contentHTML;
        
        // Save navigation history
        navigationHistory = {
            section: currentSection,
            data: null
        };
        backBtn.style.display = 'block';
        
        // Add event listeners to song cards
        setTimeout(() => {
            document.querySelectorAll('.card[data-song-id]').forEach(card => {
                card.addEventListener('click', function() {
                    const songId = this.getAttribute('data-song-id');
                    playSong(songId);
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading artist detail:', error);
        showNotification('Error memuat detail artis!', 'error');
    } finally {
        showLoading(false);
    }
}

async function showAlbumDetail(albumId) {
    showLoading(true);
    
    try {
        // Get album details
        const { data: album, error: albumError } = await supabaseClient
            .from('albums_oraplay')
            .select('*')
            .eq('id', albumId)
            .single();
        
        if (albumError || !album) {
            showNotification('Album tidak ditemukan!', 'error');
            showLoading(false);
            return;
        }
        
        // Get artist details
        let artistName = 'Unknown Artist';
        if (album.artist_id) {
            const { data: artist } = await supabaseClient
                .from('artists_oraplay')
                .select('name')
                .eq('id', album.artist_id)
                .single();
            if (artist) artistName = artist.name;
        }
        
        // Get genre name
        let genreName = 'Unknown Genre';
        if (album.genre_id) {
            const { data: genre } = await supabaseClient
                .from('genres_oraplay')
                .select('name')
                .eq('id', album.genre_id)
                .single();
            if (genre) genreName = genre.name;
        }
        
        // Get album's songs
        const { data: songs, error: songsError } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .eq('album_id', albumId);
        
        let contentHTML = `
            <div class="card-details">
                <div class="detail-header">
                    <div class="detail-img">
                        ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                    </div>
                    <div class="detail-info">
                        <h1 class="detail-name">${album.title}</h1>
                        <div class="detail-meta">
                            <p>${artistName} • ${album.year} • ${genreName}</p>
                            <p>${songs ? songs.length : 0} Lagu</p>
                        </div>
                    </div>
                </div>
        `;
        
        // Show songs
        if (songs && songs.length > 0) {
            contentHTML += `
                <h3 class="section-title">LAGU DALAM ALBUM (${songs.length})</h3>
                <div class="home-grid">
            `;
            
            for (const song of songs) {
                contentHTML += `
                    <div class="card" data-song-id="${song.id}">
                        <div class="card-img">
                            ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : 
                              (album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-music"></i>')}
                        </div>
                        <div class="card-title">${song.title}</div>
                        <div class="card-subtitle">${formatTime(song.duration)}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        contentHTML += '</div>';
        mainContent.innerHTML = contentHTML;
        
        // Save navigation history
        navigationHistory = {
            section: currentSection,
            data: null
        };
        backBtn.style.display = 'block';
        
        // Add event listeners to song cards
        setTimeout(() => {
            document.querySelectorAll('.card[data-song-id]').forEach(card => {
                card.addEventListener('click', function() {
                    const songId = this.getAttribute('data-song-id');
                    playSong(songId);
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading album detail:', error);
        showNotification('Error memuat detail album!', 'error');
    } finally {
        showLoading(false);
    }
}

async function showGenreDetail(genreId) {
    showLoading(true);
    
    try {
        // Get genre details
        const { data: genre, error: genreError } = await supabaseClient
            .from('genres_oraplay')
            .select('*')
            .eq('id', genreId)
            .single();
        
        if (genreError || !genre) {
            showNotification('Genre tidak ditemukan!', 'error');
            showLoading(false);
            return;
        }
        
        // Get artists in this genre
        const { data: artists, error: artistsError } = await supabaseClient
            .from('artists_oraplay')
            .select('*')
            .eq('genre_id', genreId);
        
        // Get albums in this genre
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums_oraplay')
            .select('*')
            .eq('genre_id', genreId);
        
        // Get songs in this genre
        const { data: songs, error: songsError } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .eq('genre_id', genreId);
        
        let contentHTML = `
            <div class="card-details">
                <div class="detail-header">
                    <div class="detail-img" style="background-color: ${genre.color};">
                        <i class="fas fa-tag"></i>
                    </div>
                    <div class="detail-info">
                        <h1 class="detail-name">${genre.name}</h1>
                        <div class="detail-meta">
                            <p>${artists ? artists.length : 0} Artis • ${albums ? albums.length : 0} Album • ${songs ? songs.length : 0} Lagu</p>
                        </div>
                    </div>
                </div>
        `;
        
        // Show artists
        if (artists && artists.length > 0) {
            contentHTML += `
                <h3 class="section-title">ARTIS (${artists.length})</h3>
                <div class="home-grid">
            `;
            
            for (const artist of artists) {
                contentHTML += `
                    <div class="card" onclick="showArtistDetail('${artist.id}')">
                        <div class="card-img">
                            ${artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-user"></i>'}
                        </div>
                        <div class="card-title">${artist.name}</div>
                        <div class="card-subtitle">${artist.country}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        // Show albums
        if (albums && albums.length > 0) {
            contentHTML += `
                <h3 class="section-title">ALBUM (${albums.length})</h3>
                <div class="home-grid">
            `;
            
            for (const album of albums) {
                let albumArtistName = 'Unknown Artist';
                if (album.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', album.artist_id)
                        .single();
                    if (artist) albumArtistName = artist.name;
                }
                
                contentHTML += `
                    <div class="card" onclick="showAlbumDetail('${album.id}')">
                        <div class="card-img">
                            ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                        </div>
                        <div class="card-title">${album.title}</div>
                        <div class="card-subtitle">${albumArtistName} • ${album.year}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        // Show songs
        if (songs && songs.length > 0) {
            contentHTML += `
                <h3 class="section-title">LAGU (${songs.length})</h3>
                <div class="home-grid">
            `;
            
            for (const song of songs) {
                let songArtistName = 'Unknown Artist';
                if (song.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', song.artist_id)
                        .single();
                    if (artist) songArtistName = artist.name;
                }
                
                contentHTML += `
                    <div class="card" data-song-id="${song.id}">
                        <div class="card-img">
                            ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : '<i class="fas fa-music"></i>'}
                        </div>
                        <div class="card-title">${song.title}</div>
                        <div class="card-subtitle">${songArtistName} • ${formatTime(song.duration)}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
        }
        
        contentHTML += '</div>';
        mainContent.innerHTML = contentHTML;
        
        // Save navigation history
        navigationHistory = {
            section: currentSection,
            data: null
        };
        backBtn.style.display = 'block';
        
        // Add event listeners to song cards
        setTimeout(() => {
            document.querySelectorAll('.card[data-song-id]').forEach(card => {
                card.addEventListener('click', function() {
                    const songId = this.getAttribute('data-song-id');
                    playSong(songId);
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('Error loading genre detail:', error);
        showNotification('Error memuat detail genre!', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== CONTENT LOADING FUNCTIONS ====================
async function loadContent() {
    showLoading(true);
    
    let contentHTML = '';
    
    try {
        switch(currentSection) {
            case 'home':
                contentHTML = await loadHomeContent();
                break;
                
            case 'albums':
                contentHTML = await loadAlbumsContent();
                break;
                
            case 'songs':
                contentHTML = await loadSongsContent();
                break;
                
            case 'artists':
                contentHTML = await loadArtistsContent();
                break;
                
            case 'genres':
                contentHTML = await loadGenresContent();
                break;
        }
    } catch (error) {
        console.error('Error loading content:', error);
        contentHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat konten. Silakan refresh halaman.</p>
            </div>
        `;
    }
    
    mainContent.innerHTML = contentHTML;
    
    // Add event listeners
    setTimeout(() => {
        // Song cards
        document.querySelectorAll('.card[data-song-id]').forEach(card => {
            card.addEventListener('click', function() {
                const songId = this.getAttribute('data-song-id');
                playSong(songId);
            });
        });
        
        // Artist cards
        document.querySelectorAll('.card[data-artist-id]').forEach(card => {
            card.addEventListener('click', function() {
                const artistId = this.getAttribute('data-artist-id');
                showArtistDetail(artistId);
            });
        });
        
        // Album cards
        document.querySelectorAll('.card[data-album-id]').forEach(card => {
            card.addEventListener('click', function() {
                const albumId = this.getAttribute('data-album-id');
                showAlbumDetail(albumId);
            });
        });
        
        // Genre cards
        document.querySelectorAll('.card[data-genre-id]').forEach(card => {
            card.addEventListener('click', function() {
                const genreId = this.getAttribute('data-genre-id');
                showGenreDetail(genreId);
            });
        });
    }, 100);
    
    showLoading(false);
}

async function loadHomeContent() {
    let contentHTML = '<h2 class="section-title">BERANDA</h2>';
    
    try {
        // Load recent songs
        const { data: songs, error: songsError } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6);
        
        // Load artists
        const { data: artists, error: artistsError } = await supabaseClient
            .from('artists_oraplay')
            .select('*')
            .limit(6);
        
        // Load albums
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums_oraplay')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6);
        
        if (songs && songs.length > 0) {
            contentHTML += `
                <div class="home-section">
                    <h3 class="section-title">LAGU TERBARU</h3>
                    <div class="home-grid">
            `;
            
            for (const song of songs) {
                let artistName = 'Unknown Artist';
                let genreName = 'Unknown';
                
                // Get artist name
                if (song.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', song.artist_id)
                        .single();
                    if (artist) artistName = artist.name;
                }
                
                // Get genre name
                if (song.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', song.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-song-id="${song.id}">
                        <div class="card-img">
                            ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : '<i class="fas fa-music"></i>'}
                        </div>
                        <div class="card-title">${song.title}</div>
                        <div class="card-subtitle">${artistName}</div>
                        <div class="card-subtitle">${formatTime(song.duration)} • ${genreName}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div></div>';
        }
        
        if (artists && artists.length > 0) {
            contentHTML += `
                <div class="home-section">
                    <h3 class="section-title">ARTIS POPULER</h3>
                    <div class="home-grid">
            `;
            
            for (const artist of artists) {
                let genreName = 'Unknown Genre';
                
                // Get genre name
                if (artist.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', artist.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-artist-id="${artist.id}">
                        <div class="card-img">
                            ${artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-user"></i>'}
                        </div>
                        <div class="card-title">${artist.name}</div>
                        <div class="card-subtitle">${artist.country}</div>
                        <div class="card-subtitle">${genreName}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div></div>';
        }
        
        if (albums && albums.length > 0) {
            contentHTML += `
                <div class="home-section">
                    <h3 class="section-title">ALBUM TERBARU</h3>
                    <div class="home-grid">
            `;
            
            for (const album of albums) {
                let artistName = 'Unknown Artist';
                let genreName = 'Unknown';
                
                // Get artist name
                if (album.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', album.artist_id)
                        .single();
                    if (artist) artistName = artist.name;
                }
                
                // Get genre name
                if (album.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', album.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-album-id="${album.id}">
                        <div class="card-img">
                            ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                        </div>
                        <div class="card-title">${album.title}</div>
                        <div class="card-subtitle">${artistName}</div>
                        <div class="card-subtitle">${album.year} • ${genreName}</div>
                    </div>
                `;
            }
            
            contentHTML += '</div></div>';
        }
        
        if ((!songs || songs.length === 0) && 
            (!artists || artists.length === 0) && 
            (!albums || albums.length === 0)) {
            contentHTML += `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>Belum ada konten. Admin perlu menambahkan musik terlebih dahulu.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Gunakan akun admin untuk menambahkan konten:</p>
                    <p style="font-size: 0.8rem; color: var(--accent-color);">Username: admin | Password: RANTAUPRAPAT123</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading home content:', error);
        contentHTML += `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat konten beranda.</p>
            </div>
        `;
    }
    
    return contentHTML;
}

async function loadAlbumsContent() {
    try {
        const { data: albums, error } = await supabaseClient
            .from('albums_oraplay')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error || !albums || albums.length === 0) {
            return `
                <h2 class="section-title">ALBUM</h2>
                <div class="empty-state">
                    <i class="fas fa-compact-disc"></i>
                    <p>Belum ada album. Admin perlu menambahkan album terlebih dahulu.</p>
                </div>
            `;
        } else {
            let contentHTML = '<h2 class="section-title">ALBUM</h2><div class="home-grid">';
            
            for (const album of albums) {
                let artistName = 'Unknown Artist';
                let genreName = 'Unknown';
                
                // Get artist name
                if (album.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', album.artist_id)
                        .single();
                    if (artist) artistName = artist.name;
                }
                
                // Get genre name
                if (album.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', album.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-album-id="${album.id}">
                        <div class="card-img">
                            ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                        </div>
                        <div class="card-title">${album.title}</div>
                        <div class="card-subtitle">${artistName}</div>
                        <div class="card-subtitle">${album.year} • ${genreName}</div>
                    </div>
                `;
            }
            contentHTML += '</div>';
            return contentHTML;
        }
    } catch (error) {
        console.error('Error loading albums:', error);
        return `
            <h2 class="section-title">ALBUM</h2>
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat album.</p>
            </div>
        `;
    }
}

async function loadSongsContent() {
    try {
        const { data: songs, error } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error || !songs || songs.length === 0) {
            return `
                <h2 class="section-title">LAGU</h2>
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>Belum ada lagu. Admin perlu menambahkan lagu terlebih dahulu.</p>
                </div>
            `;
        } else {
            let contentHTML = '<h2 class="section-title">LAGU</h2><div class="home-grid">';
            
            for (const song of songs) {
                let artistName = 'Unknown Artist';
                let albumTitle = 'Single';
                let genreName = 'Unknown';
                
                // Get artist name
                if (song.artist_id) {
                    const { data: artist } = await supabaseClient
                        .from('artists_oraplay')
                        .select('name')
                        .eq('id', song.artist_id)
                        .single();
                    if (artist) artistName = artist.name;
                }
                
                // Get album title
                if (song.album_id) {
                    const { data: album } = await supabaseClient
                        .from('albums_oraplay')
                        .select('title')
                        .eq('id', song.album_id)
                        .single();
                    if (album) albumTitle = album.title;
                }
                
                // Get genre name
                if (song.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', song.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-song-id="${song.id}">
                        <div class="card-img">
                            ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : '<i class="fas fa-music"></i>'}
                        </div>
                        <div class="card-title">${song.title}</div>
                        <div class="card-subtitle">${artistName}</div>
                        <div class="card-subtitle">${albumTitle} • ${formatTime(song.duration)} • ${genreName}</div>
                    </div>
                `;
            }
            contentHTML += '</div>';
            return contentHTML;
        }
    } catch (error) {
        console.error('Error loading songs:', error);
        return `
            <h2 class="section-title">LAGU</h2>
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat lagu.</p>
            </div>
        `;
    }
}

async function loadArtistsContent() {
    try {
        const { data: artists, error } = await supabaseClient
            .from('artists_oraplay')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error || !artists || artists.length === 0) {
            return `
                <h2 class="section-title">ARTIS</h2>
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>Belum ada artis. Admin perlu menambahkan artis terlebih dahulu.</p>
                </div>
            `;
        } else {
            let contentHTML = '<h2 class="section-title">ARTIS</h2><div class="home-grid">';
            
            for (const artist of artists) {
                let genreName = 'Unknown Genre';
                
                // Get genre name
                if (artist.genre_id) {
                    const { data: genre } = await supabaseClient
                        .from('genres_oraplay')
                        .select('name')
                        .eq('id', artist.genre_id)
                        .single();
                    if (genre) genreName = genre.name;
                }
                
                contentHTML += `
                    <div class="card" data-artist-id="${artist.id}">
                        <div class="card-img">
                            ${artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-user"></i>'}
                        </div>
                        <div class="card-title">${artist.name}</div>
                        <div class="card-subtitle">${artist.country}</div>
                        <div class="card-subtitle">${genreName}</div>
                    </div>
                `;
            }
            contentHTML += '</div>';
            return contentHTML;
        }
    } catch (error) {
        console.error('Error loading artists:', error);
        return `
            <h2 class="section-title">ARTIS</h2>
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat artis.</p>
            </div>
        `;
    }
}

async function loadGenresContent() {
    try {
        const { data: genres, error } = await supabaseClient
            .from('genres_oraplay')
            .select('*')
            .order('name', { ascending: true });
        
        if (error || !genres || genres.length === 0) {
            return `
                <h2 class="section-title">GENRE</h2>
                <div class="empty-state">
                    <i class="fas fa-tags"></i>
                    <p>Belum ada genre. Admin perlu menambahkan genre terlebih dahulu.</p>
                </div>
            `;
        } else {
            let contentHTML = '<h2 class="section-title">GENRE</h2><div class="home-grid">';
            
            for (const genre of genres) {
                // Get song count for this genre
                const { count: songCount, error: countError } = await supabaseClient
                    .from('songs_oraplay')
                    .select('*', { count: 'exact', head: true })
                    .eq('genre_id', genre.id);
                
                const songCountNumber = countError ? 0 : songCount;
                
                contentHTML += `
                    <div class="card" data-genre-id="${genre.id}" style="border-color: ${genre.color};">
                        <div class="card-img" style="background-color: ${genre.color};">
                            <i class="fas fa-tag"></i>
                        </div>
                        <div class="card-title">${genre.name}</div>
                        <div class="card-subtitle">${songCountNumber} Lagu</div>
                    </div>
                `;
            }
            
            contentHTML += '</div>';
            return contentHTML;
        }
    } catch (error) {
        console.error('Error loading genres:', error);
        return `
            <h2 class="section-title">GENRE</h2>
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error memuat genre.</p>
            </div>
        `;
    }
}

// ==================== LOAD ADMIN DATA ====================
async function loadAdminData() {
    showLoading(true);
    
    try {
        // Load artists list
        if (document.getElementById('artists-list')) {
            try {
                const { data: artists, error } = await supabaseClient
                    .from('artists_oraplay')
                    .select('*')
                    .order('name', { ascending: true });
                
                const artistsList = document.getElementById('artists-list');
                const emptyArtists = document.getElementById('empty-artists');
                
                if (error || !artists || artists.length === 0) {
                    if (emptyArtists) emptyArtists.style.display = 'block';
                    if (artistsList) {
                        artistsList.innerHTML = '<h3 class="section-title">DAFTAR ARTIS</h3>';
                        if (emptyArtists) artistsList.appendChild(emptyArtists);
                    }
                } else {
                    if (emptyArtists) emptyArtists.style.display = 'none';
                    
                    let artistsHTML = '<h3 class="section-title">DAFTAR ARTIS</h3>';
                    
                    for (const artist of artists) {
                        let genreName = 'Unknown Genre';
                        
                        if (artist.genre_id) {
                            const { data: genre } = await supabaseClient
                                .from('genres_oraplay')
                                .select('name')
                                .eq('id', artist.genre_id)
                                .single();
                            if (genre) genreName = genre.name;
                        }
                        
                        artistsHTML += `
                            <div class="admin-item">
                                <div class="admin-item-info">
                                    <div class="admin-item-img">
                                        ${artist.image_url ? `<img src="${artist.image_url}" alt="${artist.name}">` : '<i class="fas fa-user"></i>'}
                                    </div>
                                    <div>
                                        <div class="card-title">${artist.name}</div>
                                        <div class="card-subtitle">${artist.country} • ${genreName}</div>
                                    </div>
                                </div>
                                <button class="pixel-btn" onclick="deleteArtist('${artist.id}')">HAPUS</button>
                            </div>
                        `;
                    }
                    
                    if (artistsList) {
                        artistsList.innerHTML = artistsHTML;
                    }
                }
            } catch (error) {
                console.error('Error loading artists:', error);
            }
        }
        
        // Load albums list
        if (document.getElementById('albums-list')) {
            try {
                const { data: albums, error } = await supabaseClient
                    .from('albums_oraplay')
                    .select('*')
                    .order('title', { ascending: true });
                
                const albumsList = document.getElementById('albums-list');
                const emptyAlbums = document.getElementById('empty-albums');
                
                if (error || !albums || albums.length === 0) {
                    if (emptyAlbums) emptyAlbums.style.display = 'block';
                    if (albumsList) {
                        albumsList.innerHTML = '<h3 class="section-title">DAFTAR ALBUM</h3>';
                        if (emptyAlbums) albumsList.appendChild(emptyAlbums);
                    }
                } else {
                    if (emptyAlbums) emptyAlbums.style.display = 'none';
                    
                    let albumsHTML = '<h3 class="section-title">DAFTAR ALBUM</h3>';
                    
                    for (const album of albums) {
                        let artistName = 'Unknown Artist';
                        let genreName = 'Unknown';
                        
                        // Get artist name
                        if (album.artist_id) {
                            const { data: artist } = await supabaseClient
                                .from('artists_oraplay')
                                .select('name')
                                .eq('id', album.artist_id)
                                .single();
                            if (artist) artistName = artist.name;
                        }
                        
                        // Get genre name
                        if (album.genre_id) {
                            const { data: genre } = await supabaseClient
                                .from('genres_oraplay')
                                .select('name')
                                .eq('id', album.genre_id)
                                .single();
                            if (genre) genreName = genre.name;
                        }
                        
                        albumsHTML += `
                            <div class="admin-item">
                                <div class="admin-item-info">
                                    <div class="admin-item-img">
                                        ${album.cover_url ? `<img src="${album.cover_url}" alt="${album.title}">` : '<i class="fas fa-compact-disc"></i>'}
                                    </div>
                                    <div>
                                        <div class="card-title">${album.title}</div>
                                        <div class="card-subtitle">${artistName} • ${album.year} • ${genreName}</div>
                                    </div>
                                </div>
                                <button class="pixel-btn" onclick="deleteAlbum('${album.id}')">HAPUS</button>
                            </div>
                        `;
                    }
                    
                    if (albumsList) {
                        albumsList.innerHTML = albumsHTML;
                    }
                }
            } catch (error) {
                console.error('Error loading albums:', error);
            }
        }
        
        // Load songs list
        if (document.getElementById('songs-list')) {
            try {
                const { data: songs, error } = await supabaseClient
                    .from('songs_oraplay')
                    .select('*')
                    .order('title', { ascending: true });
                
                const songsList = document.getElementById('songs-list');
                const emptySongs = document.getElementById('empty-songs');
                
                if (error || !songs || songs.length === 0) {
                    if (emptySongs) emptySongs.style.display = 'block';
                    if (songsList) {
                        songsList.innerHTML = '<h3 class="section-title">DAFTAR LAGU</h3>';
                        if (emptySongs) songsList.appendChild(emptySongs);
                    }
                } else {
                    if (emptySongs) emptySongs.style.display = 'none';
                    
                    let songsHTML = '<h3 class="section-title">DAFTAR LAGU</h3>';
                    
                    for (const song of songs) {
                        let artistName = 'Unknown Artist';
                        let albumTitle = 'Single';
                        let genreName = 'Unknown';
                        
                        // Get artist name
                        if (song.artist_id) {
                            const { data: artist } = await supabaseClient
                                .from('artists_oraplay')
                                .select('name')
                                .eq('id', song.artist_id)
                                .single();
                            if (artist) artistName = artist.name;
                        }
                        
                        // Get album title
                        if (song.album_id) {
                            const { data: album } = await supabaseClient
                                .from('albums_oraplay')
                                .select('title')
                                .eq('id', song.album_id)
                                .single();
                            if (album) albumTitle = album.title;
                        }
                        
                        // Get genre name
                        if (song.genre_id) {
                            const { data: genre } = await supabaseClient
                                .from('genres_oraplay')
                                .select('name')
                                .eq('id', song.genre_id)
                                .single();
                            if (genre) genreName = genre.name;
                        }
                        
                        songsHTML += `
                            <div class="admin-item">
                                <div class="admin-item-info">
                                    <div class="admin-item-img">
                                        ${song.cover_url ? `<img src="${song.cover_url}" alt="${song.title}">` : '<i class="fas fa-music"></i>'}
                                    </div>
                                    <div>
                                        <div class="card-title">${song.title}</div>
                                        <div class="card-subtitle">${artistName} • ${albumTitle} • ${formatTime(song.duration)} • ${genreName}</div>
                                    </div>
                                </div>
                                <button class="pixel-btn" onclick="deleteSong('${song.id}')">HAPUS</button>
                            </div>
                        `;
                    }
                    
                    if (songsList) {
                        songsList.innerHTML = songsHTML;
                    }
                }
            } catch (error) {
                console.error('Error loading songs:', error);
            }
        }
        
        // Load genres list
        if (document.getElementById('genres-list')) {
            try {
                const { data: genres, error } = await supabaseClient
                    .from('genres_oraplay')
                    .select('*')
                    .order('name', { ascending: true });
                
                const genresList = document.getElementById('genres-list');
                const emptyGenres = document.getElementById('empty-genres');
                
                if (error || !genres || genres.length === 0) {
                    if (emptyGenres) emptyGenres.style.display = 'block';
                    if (genresList) {
                        genresList.innerHTML = '<h3 class="section-title">DAFTAR GENRE</h3>';
                        if (emptyGenres) genresList.appendChild(emptyGenres);
                    }
                } else {
                    if (emptyGenres) emptyGenres.style.display = 'none';
                    
                    let genresHTML = '<h3 class="section-title">DAFTAR GENRE</h3>';
                    genres.forEach(genre => {
                        genresHTML += `
                            <div class="admin-item">
                                <div class="admin-item-info">
                                    <div class="admin-item-img" style="background-color: ${genre.color};">
                                        <i class="fas fa-tag"></i>
                                    </div>
                                    <div>
                                        <div class="card-title">${genre.name}</div>
                                    </div>
                                </div>
                                <button class="pixel-btn" onclick="deleteGenre('${genre.id}')">HAPUS</button>
                            </div>
                        `;
                    });
                    
                    if (genresList) {
                        genresList.innerHTML = genresHTML;
                    }
                }
            } catch (error) {
                console.error('Error loading genres:', error);
            }
        }
        
    } catch (error) {
        console.error('Error in loadAdminData:', error);
        showNotification('Error memuat data admin', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== PLAYER FUNCTIONS ====================
async function playSong(songId) {
    try {
        const { data: song, error } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .eq('id', songId)
            .single();
        
        if (error || !song) {
            showNotification('Lagu tidak ditemukan!', 'error');
            return;
        }
        
        // Load all songs for playlist
        const { data: allSongs, error: allError } = await supabaseClient
            .from('songs_oraplay')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!allError && allSongs) {
            currentPlaylist = allSongs;
            currentSongIndex = currentPlaylist.findIndex(s => s.id === songId);
            playCurrentSong();
        }
    } catch (error) {
        console.error('Error playing song:', error);
        showNotification('Error memuat lagu!', 'error');
    }
}

function playCurrentSong() {
    if (currentPlaylist.length === 0) return;
    
    const song = currentPlaylist[currentSongIndex];
    
    // Get artist name
    const getArtistName = async () => {
        if (song.artist_id) {
            try {
                const { data: artist } = await supabaseClient
                    .from('artists_oraplay')
                    .select('name')
                    .eq('id', song.artist_id)
                    .single();
                return artist ? artist.name : 'Unknown Artist';
            } catch (error) {
                return 'Unknown Artist';
            }
        }
        return 'Unknown Artist';
    };
    
    getArtistName().then(artistName => {
        playerTitle.textContent = song.title;
        playerArtist.textContent = artistName;
        
        // Play the audio
        audioPlayer.src = song.audio_url;
        audioPlayer.play();
        isPlaying = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        
        musicPlayer.style.display = 'flex';
        totalTimeSpan.textContent = formatTime(song.duration);
    });
}

function togglePlay() {
    if (currentPlaylist.length === 0) return;
    
    if (isPlaying) {
        audioPlayer.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        audioPlayer.play();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    isPlaying = !isPlaying;
}

function playPrevSong() {
    if (currentPlaylist.length === 0) return;
    
    currentSongIndex--;
    if (currentSongIndex < 0) {
        currentSongIndex = currentPlaylist.length - 1;
    }
    
    playCurrentSong();
}

function playNextSong() {
    if (currentPlaylist.length === 0) return;
    
    currentSongIndex++;
    if (currentSongIndex >= currentPlaylist.length) {
        currentSongIndex = 0;
    }
    
    playCurrentSong();
}

// ==================== DELETE FUNCTIONS ====================
window.deleteArtist = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus artis ini?')) return;
    
    showLoading(true);
    
    try {
        const { error } = await supabaseClient
            .from('artists_oraplay')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Artis berhasil dihapus!', 'success');
        loadAdminData();
        loadArtistsForDropdowns();
        
    } catch (error) {
        console.error('Error deleting artist:', error);
        showNotification('Error menghapus artis!', 'error');
    } finally {
        showLoading(false);
    }
};

window.deleteAlbum = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus album ini?')) return;
    
    showLoading(true);
    
    try {
        const { error } = await supabaseClient
            .from('albums_oraplay')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Album berhasil dihapus!', 'success');
        loadAdminData();
        loadAlbumsForDropdowns();
        
    } catch (error) {
        console.error('Error deleting album:', error);
        showNotification('Error menghapus album!', 'error');
    } finally {
        showLoading(false);
    }
};

window.deleteSong = async function(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus lagu ini?')) return;
    
    showLoading(true);
    
    try {
        const { error } = await supabaseClient
            .from('songs_oraplay')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Lagu berhasil dihapus!', 'success');
        loadAdminData();
        
    } catch (error) {
        console.error('Error deleting song:', error);
        showNotification('Error menghapus lagu!', 'error');
    } finally {
        showLoading(false);
    }
};

window.deleteGenre = async function(id) {
    // Check if genre is being used
    try {
        const { count: songCount, error: songError } = await supabaseClient
            .from('songs_oraplay')
            .select('*', { count: 'exact', head: true })
            .eq('genre_id', id);
        
        const { count: artistCount, error: artistError } = await supabaseClient
            .from('artists_oraplay')
            .select('*', { count: 'exact', head: true })
            .eq('genre_id', id);
        
        if ((!songError && songCount > 0) || (!artistError && artistCount > 0)) {
            showNotification('Genre tidak dapat dihapus karena masih digunakan!', 'error');
            return;
        }
        
        if (!confirm('Apakah Anda yakin ingin menghapus genre ini?')) return;
        
        showLoading(true);
        
        const { error } = await supabaseClient
            .from('genres_oraplay')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        showNotification('Genre berhasil dihapus!', 'success');
        loadAdminData();
        loadGenresForDropdowns();
        loadGenresForTags();
        
    } catch (error) {
        console.error('Error deleting genre:', error);
        showNotification('Error menghapus genre!', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== GLOBAL FUNCTIONS FOR DETAIL VIEWS ====================
window.showArtistDetail = showArtistDetail;
window.showAlbumDetail = showAlbumDetail;
window.showGenreDetail = showGenreDetail;

// ==================== INITIALIZATION ====================
window.addEventListener('load', async () => {
    // Initialize theme
    initTheme();
    
    // Load initial dropdown data
    await loadArtistsForDropdowns();
    await loadGenresForDropdowns();
    await loadGenresForTags();
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('oraplyCurrentUser');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        
        if (currentUser.isAdmin) {
            showAdminDashboard();
        } else {
            showMainApp();
        }
    } else {
        showLandingPage();
    }
});