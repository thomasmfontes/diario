import { db } from './config.js';
import { getCurrentUser } from './user.js';
import { showToast } from './ui.js';

// Target date: 1st of July 2026
const targetDate = new Date('2026-07-01T00:00:00');

// Dating start date: 1st of July 2025
const startDate = new Date('2025-07-01T00:00:00');

// Playlist configuration for audio controller (with local URLs and web fallbacks)
const tracks = [
    { name: "Love in Mexico - Carmen María and Edu Espinal", url: "audio/Love in Mexico - Carmen María and Edu Espinal.mp3", fallback: "audio/Love in Mexico - Carmen María and Edu Espinal.mp3" },
    { name: "Arms of Heaven - Aakash Gandhi", url: "audio/Arms of Heaven - Aakash Gandhi.mp3", fallback: "audio/Arms of Heaven - Aakash Gandhi.mp3" },
    { name: "The Beauty of Love - Aakash Gandhi", url: "audio/The Beauty of Love - Aakash Gandhi.mp3", fallback: "audio/The Beauty of Love - Aakash Gandhi.mp3" },
    { name: "The Engagement - Silent Partner", url: "audio/The Engagement - Silent Partner.mp3", fallback: "audio/The Engagement - Silent Partner.mp3" },
    { name: "Young And Old Know Love - Puddle of Infinity", url: "audio/Young And Old Know Love - Puddle of Infinity.mp3", fallback: "audio/Young And Old Know Love - Puddle of Infinity.mp3" }
];

let currentTrackIndex = 0;
const audio = new Audio();
audio.loop = false;

// Voice audio for the love letter slide (Slide 5)
const voiceAudio = new Audio('audio/Voz-diario.m4a');
voiceAudio.loop = false;

let currentSlideIndex = 0;
let touchStartX = 0;
let touchEndX = 0;
let photoInterval = null;
let typewriterInterval = null;
let slideTimeout = null;
const SLIDE_DURATION = 8000; // 8 segundos por slide
let statsData = { days: 365, memories: 0, letters: 0 };
let anniversaryPhotos = [];
const preloadedImages = {};
let countdownInterval = null;

// Gestures and Pause/Resume variables
let isPaused = false;
let pauseStartTime = 0;
let slideStartTime = 0;
let remainingTime = SLIDE_DURATION;
let pressTimer = null;
let isHolding = false;
let lastTouchTime = 0;
let heartInterval = null;
let audioWasPlayingBeforePause = false;
let fadeInterval = null; // Tracks audio fade transitions

function preloadAnniversaryPhoto(index) {
    if (anniversaryPhotos.length === 0) return;
    const targetIdx = index % anniversaryPhotos.length;
    const photo = anniversaryPhotos[targetIdx];
    if (photo && photo.src && !preloadedImages[photo.src]) {
        const img = new Image();
        img.src = photo.src;
        preloadedImages[photo.src] = img;
    }
}

const loveLetterText = `Meu amor,

hoje celebramos 1 ano desde que decidimos começar a nossa jornada juntos, de mãos dadas. 365 dias repletos de sorrisos compartilhados, carinho sem limites, cumplicidade e momentos que agora vivem para sempre no nosso Diário e no meu coração.

Obrigado por ser minha parceira de vida, por tornar meus dias mais bonitos e por me mostrar que o amor verdadeiro é leve, paciente e cheio de paz. Agradeço cada beijinho, cada abraço e cada risada que me faz sentir em casa.

Este é apenas o primeiro ano de muitos que ainda vamos construir juntos. Mal posso esperar pelo nosso futuro.

Eu amo você, hoje, amanhã e para sempre! TIII AMUUUUU INFIDOIIIXXX ❤️`;

// Check if anniversary has been unlocked (via query params or localStorage)
export function isAnniversaryUnlocked() {
    const urlParams = new URLSearchParams(window.location.search);
    const testAnniversary = urlParams.get('testAnniversary') === 'true';
    const unlockAnniversary = urlParams.get('unlockAnniversary') === 'true';
    
    if (testAnniversary || unlockAnniversary) {
        localStorage.setItem('anniversaryUnlocked', 'true');
    }
    
    return localStorage.getItem('anniversaryUnlocked') === 'true';
}

// Check if target date (2026-07-01) has been reached
export function isTargetDateReached() {
    return new Date() >= targetDate;
}

// Render the waiting card in the DOM
export function setupWaitingCard() {
    if (!document.getElementById('anniversaryWaiting')) {
        const memoriesSection = document.getElementById('memoriesSection');
        if (memoriesSection) {
            const waitingHtml = `
            <div id="anniversaryWaiting" class="waiting-card mb-4">
                <div class="waiting-icon-container">
                    <i class="bi bi-envelope-heart"></i>
                </div>
                <div class="waiting-badge">Bloqueado</div>
                <h4 class="waiting-title">O nosso dia especial chegou! ❤️</h4>
                <p class="waiting-text">
                    Aguarde a minha chegada, pois tenho algo muito especial para te entregar... ✉️
                </p>
            </div>
            `;
            memoriesSection.insertAdjacentHTML('beforebegin', waitingHtml);
        }
    }
}

export function initAnniversary() {
    // 1. Initialize Coupons database collection
    initCouponsDB();

    // 2. Setup anniversary access states
    const unlocked = isAnniversaryUnlocked();
    const isSpecialDay = isTargetDateReached();

    const btnStory = document.getElementById('btn-story');
    const btnCupons = document.getElementById('btn-cupons');

    if (unlocked) {
        // Show anniversary action buttons
        if (btnStory) btnStory.style.display = 'inline-block';
        if (btnCupons) btnCupons.style.display = 'inline-block';

        // Remove locked cards if they exist
        const cd = document.getElementById('anniversaryCountdown');
        if (cd) cd.remove();
        const wt = document.getElementById('anniversaryWaiting');
        if (wt) wt.remove();

        setupAnniversaryCelebration();
    } else {
        // Hide anniversary action buttons
        if (btnStory) btnStory.style.display = 'none';
        if (btnCupons) btnCupons.style.display = 'none';

        if (!isSpecialDay) {
            // Countdown Mode
            const wt = document.getElementById('anniversaryWaiting');
            if (wt) wt.remove();
            setupCountdown();
        } else {
            // Waiting Card Mode
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            const cd = document.getElementById('anniversaryCountdown');
            if (cd) cd.remove();
            setupWaitingCard();
        }
    }
}

// -------------------------------------------------------------
// Database & Coupons Initialization
// -------------------------------------------------------------
function initCouponsDB() {
    const couponsRef = db.collection('coupons');
    couponsRef.get().then(snapshot => {
        if (snapshot.empty) {
            console.log('[Anniversary] Inicializando coleção de cupons de amor...');
            const defaultCoupons = [
                { name: "Jantar Especial 🍕", description: "Um jantar romântico preparado pelo Thomas com menu personalizado.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Cinema VIP em Casa 🍿", description: "Sessão cinema com pipoca, doces e ela escolhe o filme sem veto.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Massagem de 30min 💆‍♀️", description: "Massagem relaxante com óleos perfumados e música tranquila.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Dia de Mimos Extremos ✨", description: "Um dia em que o Thomas faz todos os desejos razoáveis da Gabi.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Passeio Surpresa ✈️", description: "Um roteiro surpresa planejado inteiramente pelo Thomas para o final de semana.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Socorro TPM / Chocolates 🍫", description: "Entrega rápida do chocolate favorito dela acompanhado de um bilhetinho.", status: "available", redeemedBy: null, redeemedAt: null },
                { name: "Café na Cama ☕", description: "Café da manhã completo servido na cama para acordar sorrindo.", status: "available", redeemedBy: null, redeemedAt: null }
            ];
            
            const promises = defaultCoupons.map(coupon => couponsRef.add(coupon));
            Promise.all(promises).then(() => {
                console.log('[Anniversary] Cupons inicializados com sucesso.');
            }).catch(err => {
                console.error('[Anniversary] Erro ao salvar cupons:', err);
            });
        }
    }).catch(err => {
        console.error('[Anniversary] Erro ao buscar cupons:', err);
    });
}

// -------------------------------------------------------------
// Countdown Mode (Before Anniversary)
// -------------------------------------------------------------
function setupCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    if (!document.getElementById('anniversaryCountdown')) {
        const memoriesSection = document.getElementById('memoriesSection');
        if (memoriesSection) {
            const countdownHtml = `
            <div id="anniversaryCountdown" class="card mb-4 text-center border-0 countdown-card">
                <h4 class="text-primary mb-3 font-display" style="font-family: var(--font-display); font-size: 1.25rem;">Falta pouco para o nosso 1º Ano! ❤️</h4>
                <div class="countdown-container">
                    <div class="countdown-time-block">
                        <span id="countdown-days" class="countdown-value">00</span>
                        <div class="countdown-label">Dias</div>
                    </div>
                    <div class="countdown-time-block">
                        <span id="countdown-hours" class="countdown-value">00</span>
                        <div class="countdown-label">Horas</div>
                    </div>
                    <div class="countdown-time-block">
                        <span id="countdown-minutes" class="countdown-value">00</span>
                        <div class="countdown-label">Minutos</div>
                    </div>
                    <div class="countdown-time-block">
                        <span id="countdown-seconds" class="countdown-value">00</span>
                        <div class="countdown-label">Segundos</div>
                    </div>
                </div>
            </div>
            `;
            memoriesSection.insertAdjacentHTML('beforebegin', countdownHtml);
        }
    }

    const daysEl = document.getElementById('countdown-days');
    const hoursEl = document.getElementById('countdown-hours');
    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');

    function update() {
        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            initAnniversary();
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    update();
    countdownInterval = setInterval(update, 1000);
}

// -------------------------------------------------------------
// Celebration Mode (On or After Anniversary)
// -------------------------------------------------------------
function setupAnniversaryCelebration() {
    initSlideshowControls();
    initAudioControls();
    initSwipeControls();
    initKeyboardControls();
    initCouponsUI();

    // Auto-open anniversary overlay on first session load
    if (!sessionStorage.getItem('anniversaryOpened')) {
        setTimeout(() => {
            openAnniversaryOverlay();
            sessionStorage.setItem('anniversaryOpened', 'true');
        }, 1200);
    }
}

// -------------------------------------------------------------
// Slideshow Navigation & Controls
// -------------------------------------------------------------
function openAnniversaryOverlay() {
    const overlay = document.getElementById('anniversaryOverlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scroll
        startFloatingHearts();
        showSlide(0);
        loadStatsAndRender();
    }
}

function closeAnniversaryOverlay() {
    const overlay = document.getElementById('anniversaryOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = ''; // Restore background scroll
        stopFloatingHearts();
        
        // Stop audio and voice
        audio.pause();
        if (!voiceAudio.paused) {
            voiceAudio.pause();
            voiceAudio.currentTime = 0;
        }
        
        // Clear slideshows, typewriters and auto-advance timers
        if (photoInterval) {
            clearInterval(photoInterval);
            photoInterval = null;
        }
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
        if (slideTimeout) {
            clearTimeout(slideTimeout);
            slideTimeout = null;
        }
        
        // Reset and stop local video
        const localVideo = document.getElementById('anniversaryVideo');
        if (localVideo) {
            localVideo.pause();
            localVideo.currentTime = 0;
        }
    }
}

function startFloatingHearts() {
    const container = document.getElementById('anniversaryHearts');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Spawn a heart every 350ms for a dense and active stream
    heartInterval = setInterval(() => {
        const heart = document.createElement('span');
        const heartTypes = ['❤️', '💖', '💕', '💗', '💓', '💘'];
        heart.className = 'floating-heart-dynamic';
        heart.textContent = heartTypes[Math.floor(Math.random() * heartTypes.length)];
        
        const left = Math.random() * 100;
        const size = Math.random() * 22 + 12;
        const duration = Math.random() * 5 + 4;
        const opacity = Math.random() * 0.45 + 0.25;
        const rotate = (Math.random() * 360) - 180;
        
        heart.style.left = `${left}%`;
        heart.style.fontSize = `${size}px`;
        heart.style.animationDuration = `${duration}s`;
        heart.style.setProperty('--start-opacity', opacity);
        heart.style.setProperty('--rotate-deg', `${rotate}deg`);
        
        container.appendChild(heart);
        
        setTimeout(() => {
            heart.remove();
        }, duration * 1000);
    }, 350);
}

function stopFloatingHearts() {
    if (heartInterval) {
        clearInterval(heartInterval);
        heartInterval = null;
    }
    const container = document.getElementById('anniversaryHearts');
    if (container) container.innerHTML = '';
}

function triggerHeartBurst(count = 35) {
    const container = document.getElementById('anniversaryHearts');
    if (!container) return;
    
    for (let i = 0; i < count; i++) {
        const heart = document.createElement('span');
        const heartTypes = ['❤️', '💖', '💕', '💗', '💓', '💘', '💝'];
        heart.className = 'floating-heart-dynamic';
        heart.textContent = heartTypes[Math.floor(Math.random() * heartTypes.length)];
        
        const left = Math.random() * 100;
        const size = Math.random() * 26 + 14; // Slightly larger for celebration!
        const duration = Math.random() * 3 + 3; // Faster rise for explosion effect
        const opacity = Math.random() * 0.6 + 0.3; // More visible
        const rotate = (Math.random() * 360) - 180;
        
        heart.style.left = `${left}%`;
        heart.style.fontSize = `${size}px`;
        heart.style.animationDuration = `${duration}s`;
        heart.style.setProperty('--start-opacity', opacity);
        heart.style.setProperty('--rotate-deg', `${rotate}deg`);
        
        container.appendChild(heart);
        
        setTimeout(() => {
            heart.remove();
        }, duration * 1000);
    }
}

// -------------------------------------------------------------
// Video Slide — Play Overlay & Music Fade
// -------------------------------------------------------------
let videoEventsInitialized = false;

function initVideoSlideEvents() {
    if (videoEventsInitialized) return;
    videoEventsInitialized = true;

    const localVideo = document.getElementById('anniversaryVideo');
    const playOverlay = document.getElementById('videoPlayOverlay');
    const playBtn = document.getElementById('videoPlayBtn');

    if (!localVideo || !playOverlay || !playBtn) return;

    // Clicking the overlay button starts the video
    playBtn.addEventListener('click', () => {
        localVideo.play().catch(err => console.log('[Anniversary] Video play failed:', err));
    });

    // When video actually starts playing — hide overlay, fade music down to silence
    localVideo.addEventListener('play', () => {
        playOverlay.classList.add('hidden');
        fadeTo(audio, audio.volume, 0, 1200, () => { audio.pause(); });
    });

    // When user pauses — fade music back up to full
    localVideo.addEventListener('pause', () => {
        if (!localVideo.ended) {
            // Audio was paused — need to play it first, then fade in
            audio.volume = 0;
            audio.play().catch(() => {});
            fadeTo(audio, 0, 1.0, 800);
        }
    });

    // When video ends — restore music fully, show overlay (no auto-advance)
    localVideo.addEventListener('ended', () => {
        audio.volume = 0;
        audio.play().catch(() => {});
        fadeTo(audio, 0, 1.0, 1500);
        playOverlay.classList.remove('hidden');
    });
}

// -------------------------------------------------------------
// Audio Fade Helper
// -------------------------------------------------------------
function fadeTo(audioEl, fromVol, toVol, durationMs, onComplete) {
    if (!audioEl) return;
    
    // Cancel any existing fade on this element
    if (audioEl._fadeInterval) {
        clearInterval(audioEl._fadeInterval);
        audioEl._fadeInterval = null;
    }
    
    const steps = 30;
    const stepTime = durationMs / steps;
    const volumeDelta = (toVol - fromVol) / steps;
    let currentStep = 0;
    
    audioEl.volume = Math.min(1, Math.max(0, fromVol));
    
    audioEl._fadeInterval = setInterval(() => {
        currentStep++;
        const newVol = Math.min(1, Math.max(0, fromVol + volumeDelta * currentStep));
        audioEl.volume = newVol;
        
        if (currentStep >= steps) {
            clearInterval(audioEl._fadeInterval);
            audioEl._fadeInterval = null;
            audioEl.volume = Math.min(1, Math.max(0, toVol));
            if (onComplete) onComplete();
        }
    }, stepTime);
}

function showSlide(index) {
    const slides = document.querySelectorAll('.anniversary-slide');
    if (slides.length === 0) return;
    
    // Bounds check
    let targetIndex = index;
    if (targetIndex >= slides.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = slides.length - 1;
    
    // Transition classes
    slides.forEach((slide, idx) => {
        slide.classList.remove('active', 'fade-in', 'fade-out', 'slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
        if (idx === targetIndex) {
            slide.classList.add('active', 'fade-in');
        }
    });
    
    currentSlideIndex = targetIndex;
    
    // Slide 1: Stats Slide count-up animation
    if (targetIndex === 1) {
        triggerStatsAnimation();
    }
    
    // Slide 3: Start photo slideshow
    if (targetIndex === 3) {
        initPhotoSlideshow();
    } else {
        if (photoInterval) {
            clearInterval(photoInterval);
            photoInterval = null;
        }
    }
    
    // Manage audio and video states on slide transitions
    const localVideo = document.getElementById('anniversaryVideo');
    if (targetIndex === 4) {
        // Do NOT autoplay — wait for user to click the play overlay
        // Ensure video is reset and paused when entering the slide
        if (localVideo) {
            localVideo.pause();
            localVideo.currentTime = 0;
        }
        // Show the play overlay again when entering slide
        const overlay = document.getElementById('videoPlayOverlay');
        if (overlay) overlay.classList.remove('hidden');
        // Initialize video events once (idempotent via flag)
        initVideoSlideEvents();
    } else {
        // If leaving the video slide, pause the local video player
        if (localVideo && !localVideo.paused) {
            localVideo.pause();
        }
        // Resume background music if we are on any slide except the Cover Slide (Slide 0)
        const storyOverlay = document.getElementById('anniversaryOverlay');
        if (storyOverlay && storyOverlay.classList.contains('active') && targetIndex !== 0 && audio && audio.paused) {
            audio.play().catch(err => console.log('[Anniversary] Failed to auto-resume music:', err));
        }
        // Restore music to full volume when leaving video slide
        fadeTo(audio, audio.volume, 1.0, 800);
    }
    
    // Slide 5: Typewriter letter + voice audio (with fade on background music only)
    if (targetIndex === 5) {
        // Fade background music down to 15%
        fadeTo(audio, audio.volume, 0.15, 1500);
        // Voice plays at full volume directly — no fade
        voiceAudio.volume = 1.0;
        voiceAudio.currentTime = 0;
        voiceAudio.play().catch(err => console.log('[Anniversary] Voice audio blocked:', err));
        triggerLoveLetterTypewriter();
    } else {
        // Stop voice audio immediately when leaving slide 5
        if (!voiceAudio.paused) {
            voiceAudio.pause();
            voiceAudio.currentTime = 0;
        }
        // Fade background music back to full volume
        fadeTo(audio, audio.volume, 1.0, 1500);
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
    }
    
    // Slide 6 (Encerramento): Trigger a burst of hearts
    if (targetIndex === 6) {
        triggerHeartBurst(40);
    }
    
    updateProgressIndicator();
    
    // Toggle navigation footer and tap zones visibility on Cover (Slide 0)
    const footerControls = document.querySelector('.story-footer-controls');
    const prevZone = document.getElementById('storyPrevZone');
    const nextZone = document.getElementById('storyNextZone');
    const desktopNext = document.getElementById('desktopNextBtn');
    const desktopPrev = document.getElementById('desktopPrevBtn');
    
    if (footerControls) {
        footerControls.style.display = targetIndex === 0 ? 'none' : 'flex';
    }
    if (prevZone) {
        prevZone.style.pointerEvents = targetIndex === 0 ? 'none' : 'auto';
    }
    if (nextZone) {
        nextZone.style.pointerEvents = targetIndex === 0 ? 'none' : 'auto';
    }
    if (desktopNext) {
        desktopNext.style.display = targetIndex === 0 ? 'none' : 'flex';
    }
    if (desktopPrev) {
        desktopPrev.style.display = targetIndex === 0 ? 'none' : 'flex';
    }
}

function updateProgressIndicator() {
    // Clear existing auto-advance timeout
    if (slideTimeout) {
        clearTimeout(slideTimeout);
        slideTimeout = null;
    }

    const chunks = document.querySelectorAll('.story-progress-chunk');
    chunks.forEach((chunk, idx) => {
        const fill = chunk.querySelector('.story-progress-fill');
        if (!fill) return;
        
        // Reset dynamic inline transitions
        fill.style.transition = 'none';
        
        if (idx < currentSlideIndex) {
            chunk.classList.add('completed');
            fill.style.width = '100%';
        } else if (idx > currentSlideIndex) {
            chunk.classList.remove('completed');
            fill.style.width = '0%';
        } else {
            // Current active slide
            chunk.classList.remove('completed');
            fill.style.width = '0%';
            
            // Force browser reflow to reset width to 0% immediately
            void fill.offsetHeight;
            
            // Auto-advance config: Slide 0 (Intro), 3 (Photos), 4 (Video), 5 (Letter), and 6 (End) do NOT auto-advance
            const shouldAutoAdvance = currentSlideIndex !== 0 && currentSlideIndex !== 3 && currentSlideIndex !== 4 && currentSlideIndex !== 5 && currentSlideIndex !== 6;
            
            if (shouldAutoAdvance) {
                // Animate progress width from 0% to 100% over SLIDE_DURATION
                fill.style.transition = `width ${SLIDE_DURATION}ms linear`;
                fill.style.width = '100%';
                
                // Track start time for pause/resume gestures
                slideStartTime = Date.now();
                remainingTime = SLIDE_DURATION;
                isPaused = false;
                
                // Trigger next slide after duration
                slideTimeout = setTimeout(() => {
                    showSlide(currentSlideIndex + 1);
                }, SLIDE_DURATION);
            } else {
                // If it shouldn't auto-advance, keep progress chunk static (filled)
                fill.style.width = '100%';
            }
        }
    });
}

function initSlideshowControls() {
    const btnNext = document.getElementById('storyNextBtn');
    const btnPrev = document.getElementById('storyPrevBtn');
    const btnClose = document.getElementById('storyCloseBtn');
    const btnStart = document.getElementById('startStoryBtn');
    const btnStoryTrigger = document.getElementById('btn-story');
    
    // Desktop Nav Arrow Buttons
    const btnDesktopNext = document.getElementById('desktopNextBtn');
    const btnDesktopPrev = document.getElementById('desktopPrevBtn');
    
    if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentSlideIndex + 1); });
    if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentSlideIndex - 1); });
    if (btnDesktopNext) btnDesktopNext.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentSlideIndex + 1); });
    if (btnDesktopPrev) btnDesktopPrev.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentSlideIndex - 1); });
    if (btnClose) btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeAnniversaryOverlay(); });
    
    // Final Slide Buttons
    const btnFinalCoupons = document.getElementById('finalOpenCouponsBtn');
    const btnFinalClose = document.getElementById('finalCloseBtn');
    
    if (btnFinalCoupons) {
        btnFinalCoupons.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAnniversaryOverlay();
            const modal = new bootstrap.Modal(document.getElementById('couponsModal'));
            modal.show();
        });
    }
    if (btnFinalClose) {
        btnFinalClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAnniversaryOverlay();
        });
    }
    
    if (btnStart) btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        playTrack(0);
        showSlide(1);
    });
    
    if (btnStoryTrigger) {
        btnStoryTrigger.addEventListener('click', openAnniversaryOverlay);
    }
    
    // Bind modal open
    const btnCuponsTrigger = document.getElementById('btn-cupons');
    if (btnCuponsTrigger) {
        btnCuponsTrigger.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('couponsModal'));
            modal.show();
        });
    }
    
    // Sync local video playback with story progress bar and auto-advance
    const localVideo = document.getElementById('anniversaryVideo');
    if (localVideo) {
        localVideo.addEventListener('timeupdate', () => {
            if (currentSlideIndex === 4 && localVideo.duration) {
                const fill = document.querySelector(`#chunk-4 .story-progress-fill`);
                if (fill) {
                    const percentage = (localVideo.currentTime / localVideo.duration) * 100;
                    fill.style.transition = 'none';
                    fill.style.width = `${percentage}%`;
                }
            }
        });
    }
}

// -------------------------------------------------------------
// Audio Controller (Plays sequence with local fallback)
// -------------------------------------------------------------
function initAudioControls() {
    audio.addEventListener('ended', () => {
        playNextTrack();
    });
    
    // When the voice letter finishes playing naturally, fade background music back to full volume
    voiceAudio.addEventListener('ended', () => {
        fadeTo(audio, audio.volume, 1.0, 1500);
    });
    
    audio.addEventListener('error', () => {
        const currentTrack = tracks[currentTrackIndex];
        // If local track fails to load, try play online fallback
        if (audio.src.includes(currentTrack.url) && currentTrack.fallback) {
            console.warn(`[Anniversary] Local track "${currentTrack.name}" not found. Falling back to: ${currentTrack.fallback}`);
            audio.src = currentTrack.fallback;
            audio.load();
            audio.play().catch(err => console.log('[Anniversary] Fallback audio playback blocked:', err));
        }
    });
}

function playTrack(idx) {
    currentTrackIndex = idx % tracks.length;
    const currentTrack = tracks[currentTrackIndex];
    audio.src = currentTrack.url;
    audio.load();
    audio.play()
        .then(() => {
            console.log(`[Anniversary] Tocando: ${currentTrack.name}`);
        })
        .catch(err => {
            console.log('[Anniversary] Audio playback blocked by browser. Retrying fallback direct load:', err);
            // Try fallback directly if blocked/error
            audio.src = currentTrack.fallback;
            audio.load();
            audio.play().catch(e => console.log('[Anniversary] Audio play failed completely:', e));
        });
}

function playNextTrack() {
    playTrack(currentTrackIndex + 1);
}

// -------------------------------------------------------------
// Swipe & Gesture (Instagram Story style) controls
// -------------------------------------------------------------
function handlePressStart(e) {
    // Filter simulated mouse down events on touch devices to prevent ghost clicks
    if (e.type === 'mousedown' && Date.now() - lastTouchTime < 600) {
        return;
    }
    if (e.type === 'touchstart') {
        lastTouchTime = Date.now();
    }

    // Avoid triggering on buttons, close button, inputs, video, iframes, etc.
    if (e.target.closest('#storyCloseBtn') || 
        e.target.closest('#startStoryBtn') || 
        e.target.closest('.story-footer-controls') || 
        e.target.closest('.video-wrapper') || 
        e.target.closest('video') || 
        e.target.closest('iframe') || 
        e.target.closest('.btn') || 
        e.target.closest('button')) {
        return;
    }

    pauseStartTime = Date.now();
    isHolding = false;
    
    // Set a timer to detect if this is a hold (longer than 200ms)
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        isHolding = true;
        
        // Pause auto-advance timeline
        const activeSlide = document.querySelector('.anniversary-slide.active');
        if (activeSlide) {
            const shouldAutoAdvance = currentSlideIndex !== 0 && currentSlideIndex !== 3 && currentSlideIndex !== 4 && currentSlideIndex !== 5 && currentSlideIndex !== 6;
            const fill = document.querySelector(`#chunk-${currentSlideIndex} .story-progress-fill`);
            
            if (shouldAutoAdvance && fill) {
                const elapsed = Date.now() - slideStartTime;
                remainingTime = Math.max(0, SLIDE_DURATION - elapsed);
                
                // Freeze progress bar
                const pct = (elapsed / SLIDE_DURATION) * 100;
                fill.style.transition = 'none';
                fill.style.width = `${Math.min(100, pct)}%`;
                
                if (slideTimeout) {
                    clearTimeout(slideTimeout);
                    slideTimeout = null;
                }
                isPaused = true;
            }
            
            // Pause media only on hold
            if (currentSlideIndex === 4) {
                const localVideo = document.getElementById('anniversaryVideo');
                if (localVideo && !localVideo.paused) {
                    localVideo.pause();
                }
            } else if (audio && !audio.paused) {
                audio.pause();
            }
        }
    }, 200);
}

function handlePressEnd(e) {
    // Filter simulated mouse up events on touch devices
    if (e.type === 'mouseup' && Date.now() - lastTouchTime < 600) {
        return;
    }

    // Avoid triggering on buttons, close button, inputs, video, iframes, etc.
    if (e.target.closest('#storyCloseBtn') || 
        e.target.closest('#startStoryBtn') || 
        e.target.closest('.story-footer-controls') || 
        e.target.closest('.video-wrapper') || 
        e.target.closest('video') || 
        e.target.closest('iframe') || 
        e.target.closest('.btn') || 
        e.target.closest('button')) {
        return;
    }

    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    
    if (isHolding) {
        // Resume media depending on active slide
        if (currentSlideIndex === 4) {
            const localVideo = document.getElementById('anniversaryVideo');
            if (localVideo && localVideo.paused) {
                localVideo.play().catch(err => console.log('[Anniversary] Video resume failed:', err));
            }
        } else if (audio && audio.src && audio.paused) {
            audio.play().catch(err => console.log('[Anniversary] Audio resume failed:', err));
        }
        
        const shouldAutoAdvance = currentSlideIndex !== 0 && currentSlideIndex !== 3 && currentSlideIndex !== 4 && currentSlideIndex !== 5 && currentSlideIndex !== 6;
        
        if (isPaused && shouldAutoAdvance) {
            const fill = document.querySelector(`#chunk-${currentSlideIndex} .story-progress-fill`);
            if (fill) {
                const elapsed = SLIDE_DURATION - remainingTime;
                slideStartTime = Date.now() - elapsed;
                
                // Resume progress transition
                fill.style.transition = `width ${remainingTime}ms linear`;
                fill.style.width = '100%';
                
                slideTimeout = setTimeout(() => {
                    showSlide(currentSlideIndex + 1);
                }, remainingTime);
            }
            isPaused = false;
        }
        isHolding = false;
        pauseStartTime = 0;
        return; // Swiped/held, do not navigate!
    }
    
    const pressDuration = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    pauseStartTime = 0;
    
    // If it was a short press (less than 200ms) AND it wasn't a swipe, navigate (mobile/touch only)!
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const xCoord = e.changedTouches ? e.changedTouches[0].screenX : clientX;
    const deltaX = touchStartX ? Math.abs(xCoord - touchStartX) : 0;
    
    if (currentSlideIndex === 0) return; // Prevent card tap navigation on Cover Slide (Slide 0)
    if (currentSlideIndex === 4) return; // Video slide: no tap navigation, user controls video manually
    if (e.type === 'touchend' && pressDuration < 200 && deltaX < 15) {
        const screenWidth = window.innerWidth;
        // Left 33% goes back, right 67% goes forward
        if (clientX < screenWidth * 0.33) {
            showSlide(currentSlideIndex - 1);
        } else {
            showSlide(currentSlideIndex + 1);
        }
    }
}

function initSwipeControls() {
    const card = document.querySelector('.anniversary-card');
    if (!card) return;
    
    // Touch events for mobile
    card.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        handlePressStart(e);
    }, { passive: true });
    
    card.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
        handlePressEnd(e);
    }, { passive: true });

    // Mouse events for desktop
    card.addEventListener('mousedown', e => {
        touchStartX = e.clientX; // simulate touchStartX for swipe delta check
        handlePressStart(e);
    });
    
    card.addEventListener('mouseup', e => {
        handlePressEnd(e);
    });
    
    card.addEventListener('mouseleave', () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (isPaused) {
            pauseStartTime = 0;
            const shouldAutoAdvance = currentSlideIndex !== 0 && currentSlideIndex !== 3 && currentSlideIndex !== 4 && currentSlideIndex !== 5 && currentSlideIndex !== 6;
            if (shouldAutoAdvance) {
                const fill = document.querySelector(`#chunk-${currentSlideIndex} .story-progress-fill`);
                if (fill) {
                    const elapsed = SLIDE_DURATION - remainingTime;
                    slideStartTime = Date.now() - elapsed;
                    fill.style.transition = `width ${remainingTime}ms linear`;
                    fill.style.width = '100%';
                    slideTimeout = setTimeout(() => { showSlide(currentSlideIndex + 1); }, remainingTime);
                }
            }
            // Resume audio if it is paused
            if (audio && audio.src && audio.paused) {
                audio.play().catch(() => {});
            }
            isPaused = false;
        }
        isHolding = false;
    });
}

function handleSwipeGesture() {
    if (currentSlideIndex === 0) return; // Prevent swipe gestures on Cover Slide (Slide 0)
    if (currentSlideIndex === 4) return; // Video slide: no swipe navigation
    const swipeThreshold = 50;
    if (touchStartX - touchEndX > swipeThreshold) {
        showSlide(currentSlideIndex + 1); // Swipe Left -> Next
    } else if (touchEndX - touchStartX > swipeThreshold) {
        showSlide(currentSlideIndex - 1); // Swipe Right -> Prev
    }
}

function initKeyboardControls() {
    document.addEventListener('keydown', e => {
        const overlay = document.getElementById('anniversaryOverlay');
        if (overlay && overlay.classList.contains('active')) {
            if (e.key === 'ArrowRight' || e.key === 'Space') {
                if (currentSlideIndex === 0) return; // Prevent keyboard navigation on Slide 0
                showSlide(currentSlideIndex + 1);
            } else if (e.key === 'ArrowLeft') {
                if (currentSlideIndex === 0) return; // Prevent keyboard navigation on Slide 0
                showSlide(currentSlideIndex - 1);
            } else if (e.key === 'Escape') {
                closeAnniversaryOverlay();
            }
        }
    });
}

// -------------------------------------------------------------
// Stats & First Memory Loader
// -------------------------------------------------------------
async function loadStatsAndRender() {
    try {
        // 1. Fetch memories
        const memSnapshot = await db.collection('memories').orderBy('date', 'asc').get();
        const totalMemories = memSnapshot.size;

        let thomasCount = 0;
        let gabiCount = 0;
        const monthCounts = {};
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        // Populate anniversaryPhotos for the polaroid slideshow stack
        anniversaryPhotos = [];
        memSnapshot.forEach(doc => {
            const data = doc.data();

            // Extract statistics
            const autor = (data.autor || '').trim();
            if (autor.toLowerCase() === 'thomas') {
                thomasCount++;
            } else if (autor.toLowerCase() === 'gabriela') {
                gabiCount++;
            }

            if (data.date) {
                const parts = data.date.split('-');
                if (parts.length >= 2) {
                    const monthIdx = parseInt(parts[1], 10) - 1;
                    if (monthIdx >= 0 && monthIdx < 12) {
                        const mName = monthNames[monthIdx];
                        monthCounts[mName] = (monthCounts[mName] || 0) + 1;
                    }
                }
            }

            let imgs = [];
            if (Array.isArray(data.images) && data.images.length > 0) {
                imgs = data.images;
            } else if (typeof data.image === 'string' && data.image) {
                imgs = [data.image];
            }
            
            if (imgs.length > 0) {
                imgs.forEach(img => {
                    anniversaryPhotos.push({
                        src: img,
                        title: data.title || 'Momento Especial',
                        date: data.date
                    });
                });
            }
        });

        console.log(`[Anniversary] Estatísticas calculadas: total de memórias = ${totalMemories}, Thomas = ${thomasCount}, Gabriela = ${gabiCount}`);

        // Update stats description with contributions
        const statsDescEl = document.querySelector('#slide-1 p.text-muted');
        if (statsDescEl) {
            statsDescEl.innerHTML = `Tudo o que construímos juntos no último ano...<br><span class="small text-pink" style="font-size: 0.8rem; color: var(--rosa-500); font-weight: 600;">Thomas: ${thomasCount} | Gabi: ${gabiCount}</span>`;
        }

        // Start preloading the first 8 photos immediately in the background
        for (let i = 0; i < Math.min(8, anniversaryPhotos.length); i++) {
            preloadAnniversaryPhoto(i);
        }
        
        // 2. Fetch letters count
        const msgSnapshot = await db.collection('messages').get();
        const totalLetters = msgSnapshot.size;
        
        // 3. Calculate days of relationship dynamically
        const diffTime = Math.abs(new Date() - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // 4. Update stats state
        statsData.days = Math.max(365, diffDays); // Keep at least 365 or real days
        statsData.memories = totalMemories;
        statsData.letters = totalLetters;
        
        // If currently on Slide 1, animate immediately. Otherwise update static content
        if (currentSlideIndex === 1) {
            triggerStatsAnimation();
        } else {
            const daysEl = document.getElementById('stat-days');
            const memEl = document.getElementById('stat-memories');
            const letEl = document.getElementById('stat-letters');
            if (daysEl) daysEl.textContent = statsData.days;
            if (memEl) memEl.textContent = statsData.memories;
            if (letEl) letEl.textContent = statsData.letters;
        }
        
        // 5. Render first memory details in Slide 2
        if (!memSnapshot.empty) {
            const firstMem = memSnapshot.docs[0].data();
            const firstImgEl = document.getElementById('firstMemoryImg');
            const firstTitleEl = document.getElementById('firstMemoryTitle');
            const firstDescEl = document.getElementById('firstMemoryDesc');
            
            if (firstImgEl) {
                let imgUrl = 'capa.jpg';
                if (Array.isArray(firstMem.images) && firstMem.images.length > 0) {
                    imgUrl = firstMem.images[0];
                } else if (typeof firstMem.image === 'string' && firstMem.image) {
                    imgUrl = firstMem.image;
                }
                firstImgEl.src = imgUrl;
            }
            
            if (firstTitleEl) firstTitleEl.textContent = firstMem.title || 'Nosso Começo';
            if (firstDescEl) {
                const dateStr = firstMem.date 
                    ? new Date(firstMem.date + 'T00:00:00').toLocaleDateString('pt-BR') 
                    : '';
                firstDescEl.textContent = `Registrada por ${firstMem.autor || 'Nós'} em ${dateStr}. "${firstMem.message || ''}"`;
            }
        }
    } catch (err) {
        console.error('[Anniversary] Erro ao carregar estatísticas:', err);
    }
}

// -------------------------------------------------------------
// Stats Animation (Count Up Effect)
// -------------------------------------------------------------
function triggerStatsAnimation() {
    const daysEl = document.getElementById('stat-days');
    const memEl = document.getElementById('stat-memories');
    const letEl = document.getElementById('stat-letters');
    const loveEl = document.getElementById('stat-love');

    if (daysEl) animateCount(daysEl, 0, statsData.days, 1500);
    if (memEl) animateCount(memEl, 0, statsData.memories, 1500);
    if (letEl) animateCount(letEl, 0, statsData.letters, 1500);
    if (loveEl) animateCount(loveEl, 0, 100, 1500, '%');
}

function animateCount(element, start, end, duration, suffix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

// -------------------------------------------------------------
// Ken Burns Dynamic Slideshow
// -------------------------------------------------------------
function initPhotoSlideshow() {
    const container = document.getElementById('polaroidStackContainer');
    if (!container) return;
    
    if (anniversaryPhotos.length === 0) {
        container.innerHTML = `<div class="d-flex justify-content-center align-items-center h-100 text-muted text-white">Nenhuma foto encontrada no Diário. 📸</div>`;
        return;
    }
    
    let currentIndex = 0;
    let zIndexCounter = 1;
    
    function showNextPhoto() {
        if (anniversaryPhotos.length === 0) return;
        const photo = anniversaryPhotos[currentIndex];
        
        // Preload next 3 photos to stay ahead of the stack carousel
        preloadAnniversaryPhoto(currentIndex + 1);
        preloadAnniversaryPhoto(currentIndex + 2);
        preloadAnniversaryPhoto(currentIndex + 3);
        
        // Create new polaroid stack card
        const cardEl = document.createElement('div');
        cardEl.className = 'polaroid-slideshow-frame drop-anim';
        
        // Generate random angle and offset positions for natural scrapbook style stacking
        const angle = (Math.random() * 10) - 5; // -5deg to +5deg
        const offsetX = (Math.random() * 16) - 8; // -8px to +8px
        const offsetY = (Math.random() * 16) - 8; // -8px to +8px
        
        // Set styles and css custom properties for drop keyframes
        cardEl.style.setProperty('--offsetX', `${offsetX}px`);
        cardEl.style.setProperty('--offsetY', `${offsetY}px`);
        cardEl.style.setProperty('--angle', `${angle}deg`);
        cardEl.style.zIndex = zIndexCounter++;
        
        const dateStr = photo.date ? new Date(photo.date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        
        cardEl.innerHTML = `
            <div class="polaroid-image-area" style="width: 100%; height: 230px; border-radius: 2px; overflow: hidden; position: relative; background: #111;">
                <img src="${photo.src}" class="ken-burns-img" style="width: 100%; height: 100%; object-fit: cover; animation: kenburns-zoom 6s ease-out forwards;">
            </div>
            <div class="polaroid-caption" style="margin-top: 10px; font-size: 0.85rem; pointer-events: none;">
                ${photo.title}
                <span style="color: var(--rosa-500); font-size: 0.72rem; font-family: var(--font-sans); display: block; margin-top: 2px;">${dateStr}</span>
            </div>
        `;
        
        container.appendChild(cardEl);
        
        // Remove oldest cards at the bottom of the stack to keep performance clean
        const oldCards = container.querySelectorAll('.polaroid-slideshow-frame');
        if (oldCards.length > 4) {
            const bottomCard = oldCards[0];
            bottomCard.style.opacity = 0;
            bottomCard.style.transition = 'opacity 0.4s ease';
            setTimeout(() => {
                bottomCard.remove();
            }, 400);
        }
        
        currentIndex = (currentIndex + 1) % anniversaryPhotos.length;
    }
    
    container.innerHTML = '';
    showNextPhoto();
    
    if (photoInterval) clearInterval(photoInterval);
    photoInterval = setInterval(showNextPhoto, 2000); // 2 seconds snappier interval!
}

// -------------------------------------------------------------
// Typewriter Text Effect (Love Letter)
// -------------------------------------------------------------
function triggerLoveLetterTypewriter() {
    const textEl = document.getElementById('loveLetterText');
    if (!textEl) return;
    
    if (typewriterInterval) clearInterval(typewriterInterval);
    textEl.textContent = '';
    
    let index = 0;
    typewriterInterval = setInterval(() => {
        if (index < loveLetterText.length) {
            textEl.textContent += loveLetterText.charAt(index);
            index++;
            
            // Keep container scrolled down
            const paper = document.querySelector('.love-letter-paper');
            if (paper) {
                paper.scrollTop = paper.scrollHeight;
            }
        } else {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
    }, 75);
}

// -------------------------------------------------------------
// Coupons Management
// -------------------------------------------------------------
function initCouponsUI() {
    listenToCoupons();
    initCouponRedemption();
}

function listenToCoupons() {
    let isFirstLoad = true;
    
    db.collection('coupons').onSnapshot(snapshot => {
        const container = document.getElementById('couponsContainer');
        if (!container) return;
        
        // Show a real-time toast alert if the partner redeems a coupon
        const currentUser = getCurrentUser();
        if (!isFirstLoad) {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const coupon = change.doc.data();
                    if (coupon.status === 'redeemed' && coupon.redeemedBy && coupon.redeemedBy !== currentUser) {
                        showToast(`💖 ${coupon.redeemedBy} resgatou o cupom: "${coupon.name}"!`, 'success');
                    }
                }
            });
        }
        isFirstLoad = false;
        
        if (snapshot.empty) {
            container.innerHTML = `<div class="text-center text-muted p-4">Nenhum cupom cadastrado.</div>`;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const coupon = doc.data();
            const docId = doc.id;
            
            const isRedeemed = coupon.status === 'redeemed';
            const stampText = isRedeemed 
                ? (coupon.redeemedBy === currentUser ? 'Resgatado por você' : `Resgatado por ${coupon.redeemedBy}`)
                : '';
            
            html += `
            <div class="coupon-card ${isRedeemed ? 'redeemed' : 'available'}">
                <div class="coupon-main">
                    <div class="coupon-watermark">❤️</div>
                    <h6 class="coupon-title fw-bold mb-1" style="font-size: 0.95rem;">${coupon.name}</h6>
                    <p class="small text-muted mb-0" style="font-size: 0.8rem; line-height: 1.4;">${coupon.description}</p>
                    ${isRedeemed ? `<div class="coupon-stamp">${stampText}</div>` : ''}
                </div>
                <div class="coupon-divider"></div>
                <div class="coupon-action">
                    ${isRedeemed 
                        ? `<button class="btn btn-sm btn-secondary rounded-pill px-3" disabled style="font-size: 0.78rem;">Usado</button>` 
                        : `<button class="btn btn-sm btn-primary rounded-pill px-3 btn-redeem-coupon" data-id="${docId}" data-name="${coupon.name}" style="font-size: 0.78rem; background: linear-gradient(135deg, var(--rosa-500) 0%, var(--rosa-600) 100%); border: none;">Resgatar</button>`}
                </div>
            </div>
            `;
        });
        
        container.innerHTML = html;
    }, err => {
        console.error('[Anniversary] Erro ao sincronizar cupons:', err);
    });
}

function initCouponRedemption() {
    const container = document.getElementById('couponsContainer');
    if (!container) return;
    
    // Setup listener to reopen coupons modal if user selects profile
    const userSelectModalEl = document.getElementById('userSelectModal');
    if (userSelectModalEl && !window._userSelectReopenCouponsBound) {
        window._userSelectReopenCouponsBound = true;
        userSelectModalEl.addEventListener('hidden.bs.modal', () => {
            if (window.reopenCouponsAfterUserSelect) {
                window.reopenCouponsAfterUserSelect = false;
                setTimeout(() => {
                    const couponsModalEl = document.getElementById('couponsModal');
                    if (couponsModalEl) {
                        const couponsModal = bootstrap.Modal.getOrCreateInstance(couponsModalEl);
                        couponsModal.show();
                    }
                }, 180);
            }
        });
    }
    
    // Reference confirm modal element
    const confirmRedeemModalEl = document.getElementById('confirmRedeemModal');
    
    // Setup click handler for custom confirm submit button
    const btnConfirmRedeem = document.getElementById('btnConfirmRedeemSubmit');
    if (btnConfirmRedeem && !window._confirmRedeemSubmitBound) {
        window._confirmRedeemSubmitBound = true;
        btnConfirmRedeem.addEventListener('click', async () => {
            const docId = window.pendingRedeemDocId;
            const user = window.pendingRedeemUser;
            if (!docId || !user) return;
            
            // Hide confirmRedeemModal
            const confirmModalEl = document.getElementById('confirmRedeemModal');
            if (confirmModalEl) {
                const confirmModal = bootstrap.Modal.getOrCreateInstance(confirmModalEl);
                confirmModal.hide();
            }
            
            try {
                const docRef = db.collection('coupons').doc(docId);
                const docSnap = await docRef.get();
                if (!docSnap.exists) {
                    showToast('Cupom não encontrado!', 'danger');
                    return;
                }
                
                const couponData = docSnap.data();
                if (couponData.status === 'redeemed') {
                    showToast('Este cupom já foi usado!', 'warning');
                    return;
                }
                
                await docRef.update({
                    status: 'redeemed',
                    redeemedBy: user,
                    redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast(`Cupom "${couponData.name}" resgatado! 🎉`, 'success');
                
                // Trigger push notification to partner
                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: '🎟️ Cupom de Amor Resgatados!',
                        body: `${user} resgatou o cupom: ${couponData.name}`,
                        authorName: user
                    })
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => console.log('[Anniversary] Notificação de resgate enviada:', data))
                .catch(err => console.warn('[Anniversary] Alerta de notificação (esperado em dev local):', err.message));
                
            } catch (err) {
                console.error('[Anniversary] Erro ao resgatar cupom:', err);
                showToast('Erro ao resgatar cupom.', 'danger');
            }
        });
    }
    
    // Prevent double listener bindings
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    newContainer.addEventListener('click', async e => {
        if (e.target.classList.contains('btn-redeem-coupon')) {
            const docId = e.target.getAttribute('data-id');
            const user = getCurrentUser();
            
            if (!user || (user !== 'Thomas' && user !== 'Gabriela')) {
                showToast('Identifique-se para resgatar este cupom! 👤', 'warning');
                
                // Hide coupons modal
                const couponsModalEl = document.getElementById('couponsModal');
                if (couponsModalEl) {
                    const couponsModal = bootstrap.Modal.getOrCreateInstance(couponsModalEl);
                    couponsModal.hide();
                }
                
                // Set flag to reopen
                window.reopenCouponsAfterUserSelect = true;
                
                // Open userSelectModal
                if (userSelectModalEl) {
                    const userSelectModal = bootstrap.Modal.getOrCreateInstance(userSelectModalEl);
                    userSelectModal.show();
                }
                return;
            }
            
            // Set pending data
            window.pendingRedeemDocId = docId;
            window.pendingRedeemUser = user;
            
            // Update confirm modal text
            const couponName = e.target.getAttribute('data-name') || 'este cupom';
            const confirmTextEl = document.getElementById('confirmRedeemText');
            if (confirmTextEl) {
                confirmTextEl.innerHTML = `Deseja mesmo resgatar o cupom <strong>"${couponName}"</strong>?`;
            }
            
            // Open confirm modal on top of coupons modal
            if (confirmRedeemModalEl) {
                const confirmModal = bootstrap.Modal.getOrCreateInstance(confirmRedeemModalEl);
                confirmModal.show();
            }
        }
    });
}
